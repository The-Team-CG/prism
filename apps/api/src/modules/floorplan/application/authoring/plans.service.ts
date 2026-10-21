import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject } from '@prisma/client';
import {
  AUDIT_WRITER,
  EventAccessPolicyService,
  type AuditWriter,
  type ResolvedEventOpsActor,
  writeAudit,
} from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import {
  FLOORPLAN_EVENT_REFERENCE_READER,
  type FloorplanEventReference,
  type FloorplanEventReferenceReader,
} from '@prism/contexts/event-lifecycle/floorplan-reference';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, FloorPlanObject, JsonValue, SavedPlanObject, Seat, SeatCategory } from '@prism/kernel/shared';
import type { UpdatePlanInput } from '@prism/types';
import { floorPlanScalarPatch, replaceFloorPlanObjects } from './plan-patch';
import {
  assertTableAssignmentsEligible,
  storedTableEligibilityGuests,
  storedTableEligibilityObjects,
} from './table-assignment-guard';

type UpdatePlanChanges = Omit<UpdatePlanInput, 'expectedUpdatedAt'>;

type PlanWithObjects = Prisma.FloorPlanGetPayload<{
  include: {
    objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] };
    opsDraft: { select: { eventId: true; sourceType: true; status: true } };
  };
}>;

type PlanWriteState = {
  updatedAt: Date;
  eventId: string | null;
  opsDraft: { eventId: string; sourceType: string; status: string } | null;
};

async function updatePlanWithObjects(
  tx: Prisma.TransactionClient,
  planId: string,
  scalarChanges: Omit<UpdatePlanChanges, 'objects'>,
  objects: SavedPlanObject[],
  expectedUpdatedAt: Date,
) {
  const updated = await tx.floorPlan
    .update({
      where: { id: planId, updatedAt: expectedUpdatedAt },
      data: floorPlanScalarPatch({ ...scalarChanges, objects }),
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
        opsDraft: { select: { eventId: true, sourceType: true, status: true } },
      },
    })
    .catch((error: unknown) => {
      if (isPrismaRecordMissing(error)) {
        throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
      }
      throw error;
    });
  await replaceFloorPlanObjects(tx, planId, objects);
  return updated;
}

function isPrismaRecordMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function isPrismaSerializationFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(FLOORPLAN_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: FloorplanEventReferenceReader,
  ) {}

  private mapPlan(row: PlanWithObjects, resolvedObjects?: FloorPlanObject[]): FloorPlan {
    const objects =
      resolvedObjects ??
      (row.objectRows.length
        ? row.objectRows.map((r) => r.objectData as unknown as CanvasObject)
        : asArray<CanvasObject>(row.objects));

    return {
      id: row.id,
      name: row.name,
      venue: row.venue,
      width: row.width,
      height: row.height,
      gridSize: row.gridSize,
      pax: row.pax,
      ownerId: row.ownerId,
      templateId: row.templateId,
      eventId: row.eventId,
      objects,
      guests: asArray<JsonValue>(row.guests),
      suppliers: asArray<JsonValue>(row.suppliers),
      seats: asArray<Seat>(row.seats),
      seatCategories: asArray<SeatCategory>(row.seatCategories),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPlan(planId: string, actor: ResolvedEventOpsActor): Promise<FloorPlan> {
    const row = await this.findPlan(planId);

    if (!row) throw new NotFoundException('Plan not found');
    await this.assertCanReadPlan(row, actor);

    return this.mapPlan(row);
  }

  async updatePlan(
    planId: string,
    changes: UpdatePlanInput,
    actor: ResolvedEventOpsActor,
  ): Promise<FloorPlan> {
    const plan = await this.findPlan(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const { expectedUpdatedAt: expectedUpdatedAtInput, ...requestedChanges } = changes;
    const expectedUpdatedAt = new Date(expectedUpdatedAtInput);
    const { objects, ...scalarChanges } = requestedChanges;
    const updated = await this.prisma.$transaction(async (tx) => {
      const stateBeforeLocks = await tx.floorPlan.findUnique({
        where: { id: planId },
        select: { id: true, name: true, eventId: true, updatedAt: true, opsDraft: { select: { eventId: true } } },
      });
      if (!stateBeforeLocks) throw new NotFoundException('Plan not found');
      const eventIdBeforeLocks = stateBeforeLocks.opsDraft?.eventId ?? stateBeforeLocks.eventId;
      const lifecycleEvent = eventIdBeforeLocks
        ? await this.lifecycleEventReferences.findFloorplanEvent(eventIdBeforeLocks, {
            prisma: tx,
            correlationId: `floorplan-plan-update:${planId}`,
          })
        : null;
      if (eventIdBeforeLocks && !lifecycleEvent) throw new NotFoundException('Event not found');

      // Lifecycle event and ocular rows are locked by the owner capability first. Lock the
      // Floorplan-owned draft second so approval and plan edits follow one stable lock order.
      if (stateBeforeLocks.opsDraft) {
        // QUERY_AUDIT_RAW_SQL: serialize plan mutation with same-domain draft approval.
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "floorplan"."floor_plan_drafts" WHERE "floor_plan_id" = $1 FOR UPDATE',
          planId,
        );
      }

      const latestPlan = await this.findPlan(planId, tx);
      if (!latestPlan) throw new NotFoundException('Plan not found');
      const eventIdAfterLocks = latestPlan.opsDraft?.eventId ?? latestPlan.eventId;
      if (eventIdAfterLocks !== eventIdBeforeLocks) {
        throw new ConflictException('Floorplan event changed while it was being saved; reload before saving');
      }
      await this.assertCanUpdatePlan(latestPlan, actor, requestedChanges, lifecycleEvent);
      if (latestPlan.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
      }

      if (Object.keys(requestedChanges).length === 0) return latestPlan;
      this.assertTableAssignmentsEligible(latestPlan, requestedChanges, actor);

      const saved = await this.savePlanChanges(tx, planId, scalarChanges, objects, expectedUpdatedAt);

      await writeAudit(
        this.auditWriter,
        latestPlan.opsDraft?.eventId ?? latestPlan.eventId ?? undefined,
        actor.name,
        `Updated floorplan: ${latestPlan.name}`,
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'floor_plan',
          affectedId: latestPlan.id,
          affectedLabel: latestPlan.name,
          metadata: { verified: actor.verified ?? false },
        },
        { prisma: tx, correlationId: latestPlan.opsDraft?.eventId ?? latestPlan.eventId ?? latestPlan.id, actorId: actor.id },
      );
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (isPrismaSerializationFailure(error)) {
        throw new ConflictException('Event or floorplan changed while it was being saved; reload before saving');
      }
      throw error;
    });

    return this.mapPlan(updated, objects);
  }

  /**
   * Official PMCM saves must keep every seat assignment eligible. Client preference saves are not
   * checked here because they carry no authoritative guest roster. A save that omits objects or guests
   * is checked against the stored values it leaves in place.
   */
  private assertTableAssignmentsEligible(plan: PlanWithObjects, changes: UpdatePlanChanges, actor: ResolvedEventOpsActor) {
    if (actor.role === OpsUserRole.Client) return;
    if (changes.objects === undefined && changes.guests === undefined) return;
    const storedObjects = plan.objectRows.length
      ? plan.objectRows.map((row) => row.objectData)
      : asArray<unknown>(plan.objects);
    const objects = changes.objects ?? storedTableEligibilityObjects(storedObjects);
    const guests = changes.guests ?? storedTableEligibilityGuests(asArray<unknown>(plan.guests));
    assertTableAssignmentsEligible(objects, guests);
  }

  private async savePlanChanges(
    tx: Prisma.TransactionClient,
    planId: string,
    scalarChanges: Omit<UpdatePlanChanges, 'objects'>,
    objects: UpdatePlanChanges['objects'],
    expectedUpdatedAt: Date,
  ): Promise<PlanWithObjects> {
    if (objects !== undefined) {
      return updatePlanWithObjects(tx, planId, scalarChanges, objects ?? [], expectedUpdatedAt);
    }
    return tx.floorPlan
      .update({
        where: { id: planId, updatedAt: expectedUpdatedAt },
        data: floorPlanScalarPatch(scalarChanges),
        include: {
          objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
          opsDraft: { select: { eventId: true, sourceType: true, status: true } },
        },
      })
      .catch((error: unknown) => {
        if (isPrismaRecordMissing(error)) {
          throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
        }
        throw error;
      });
  }

  private async assertCanReadPlan(plan: PlanWithObjects, actor: ResolvedEventOpsActor) {
    const eventId = plan.opsDraft?.eventId ?? plan.eventId ?? undefined;
    if (actor.role === OpsUserRole.System) return;
    const lifecycleEvent = eventId ? await this.lifecycleEventReferences.findFloorplanEvent(eventId) : null;
    if (eventId && !lifecycleEvent) throw new NotFoundException('Event not found');
    if (actor.role === OpsUserRole.PmcmAdmin) {
      if (actor.verified) return;
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'floorplan', eventId);
      throw new ForbiddenException('A verified PMCM identity is required to read this floorplan');
    }
    await this.assertClientCanReadPreference(plan, actor, eventId, lifecycleEvent);
  }

  private async assertClientCanReadPreference(
    plan: PlanWithObjects,
    actor: ResolvedEventOpsActor,
    eventId: string | undefined,
    lifecycleEvent: FloorplanEventReference | null,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'floorplan', eventId);
    const draft = plan.opsDraft;
    if (
      !draft ||
      !eventId ||
      draft.sourceType !== 'client_preference' ||
      !['client_submitted', 'revision_requested'].includes(draft.status)
    ) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan', eventId);
      throw new ForbiddenException('Official floorplans are available through the event-scoped snapshot');
    }
    if (!actor.verified || !actor.email?.trim()) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference', eventId);
      throw new ForbiddenException('A verified client identity is required to read this preference');
    }
    await this.eventAccessPolicyService.requireCanReadEvent(
      actor,
      this.toReadableEvent(lifecycleEvent!),
      'client floorplan preference',
    );
  }

  private async assertCanUpdatePlan(
    plan: PlanWithObjects,
    actor: ResolvedEventOpsActor,
    changes: UpdatePlanChanges,
    lifecycleEvent: FloorplanEventReference | null,
  ) {
    const eventId = plan.opsDraft?.eventId ?? plan.eventId ?? undefined;
    if (actor.role === OpsUserRole.Client) {
      await this.assertClientCanUpdatePreference(plan, actor, changes, lifecycleEvent, eventId);
    } else {
      await this.assertOfficialUpdater(actor, eventId);
    }

    this.assertPlanMutableState(plan, actor, lifecycleEvent);
  }

  private async assertClientCanUpdatePreference(
    plan: PlanWithObjects,
    actor: ResolvedEventOpsActor,
    changes: UpdatePlanChanges,
    lifecycleEvent: FloorplanEventReference | null,
    eventId: string | undefined,
  ) {
    if (!lifecycleEvent || !eventId) throw new NotFoundException('Event not found');
    const draft = plan.opsDraft;
    if (!draft || draft.sourceType !== 'client_preference' || draft.status !== 'revision_requested') {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan mutation', eventId);
      throw new ForbiddenException('Clients may revise a preference only after PMCM requests a revision');
    }
    if (plan.ownerId !== actor.id) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference mutation', eventId);
      throw new ForbiddenException('Only the submitting client can revise this preference');
    }
    if (!actor.verified || !actor.email?.trim()) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference mutation', eventId);
      throw new ForbiddenException('A verified client identity is required to update this preference');
    }
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'floorplan', eventId);
    await this.eventAccessPolicyService.requireCanReadEvent(
      actor,
      this.toReadableEvent(lifecycleEvent),
      'client floorplan preference',
    );
    const forbiddenFields = Object.keys(changes).filter(
      (field) => !['venue', 'width', 'height', 'gridSize', 'pax', 'objects'].includes(field),
    );
    if (forbiddenFields.length > 0) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference mutation', eventId);
      throw new ForbiddenException('Clients may only update layout preferences');
    }
  }

  private async assertOfficialUpdater(actor: ResolvedEventOpsActor, eventId: string | undefined) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'official floorplan mutation',
      eventId,
    );
    if (actor.role === OpsUserRole.PmcmAdmin && !actor.verified) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan mutation', eventId);
      throw new ForbiddenException('A verified PMCM identity is required to update this floorplan');
    }
  }

  private assertPlanMutableState(
    plan: PlanWriteState,
    actor: ResolvedEventOpsActor,
    event: FloorplanEventReference | null,
  ) {
    if (event?.archived) throw new ConflictException('Archived events cannot be changed');
    if (event?.freezeStatus === 'frozen') throw new ConflictException('Frozen event scope cannot be changed');
    if (
      actor.role !== OpsUserRole.Client &&
      plan.opsDraft &&
      ['in_review', 'approved'].includes(plan.opsDraft.status)
    ) {
      throw new ConflictException('Submitted and approved floorplans are immutable; create or reopen a draft');
    }
  }

  private toReadableEvent(event: FloorplanEventReference) {
    return {
      id: event.eventId,
      clientName: event.clientName,
      clientPortalStatus: event.clientPortalStatus,
      inquiry: { email: event.primaryClientEmail },
    };
  }

  private findPlan(planId: string, database: PrismaService | Prisma.TransactionClient = this.prisma) {
    return database.floorPlan.findUnique({
      where: { id: planId },
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
        opsDraft: { select: { eventId: true, sourceType: true, status: true } },
      },
    });
  }
}
