import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { tableAssignmentsOf, zoneSupplierIds } from '@prism/floorplan-scene';
import { FLOORPLAN_SEATING_FACTS, type FloorplanSeatingFactsReader, type FloorplanSeatingGuest } from '@prism/contexts/read-models/floorplan-seating';
import type { FloorplanSceneDocument, TableEligibilityObject, UpdatePlanInput } from '@prism/types';
import { acceptedScene, storedScene } from '../stored-scene';
import { floorPlanScalarPatch } from './plan-patch';
import { assertSeatingAllowedForNewAssignments, assertTableAssignmentsEligible, sceneTableEligibilityObjects } from './table-assignment-guard';
import type { FloorPlan } from '@prism/kernel/shared';

type UpdatePlanChanges = Omit<UpdatePlanInput, 'expectedUpdatedAt'>;

const ZONE_SUPPLIER_MESSAGE = 'Zones can only name suppliers booked on this event.';
const CLIENT_SEATING_MESSAGE = 'Your event team seats guests on the official layout.';
const CLIENT_ZONE_SUPPLIER_MESSAGE = 'Only your event team can assign suppliers to zones.';

/** A client draws layout only: seating guests and assigning zone suppliers belong to PMCM on the official layout. */
function assertClientSceneLeavesSeatingToPmcm(scene: FloorplanSceneDocument) {
  if (tableAssignmentsOf(scene).some((table) => table.guestIds.length > 0)) throw new BadRequestException(CLIENT_SEATING_MESSAGE);
  if (zoneSupplierIds(scene).length > 0) throw new BadRequestException(CLIENT_ZONE_SUPPLIER_MESSAGE);
}

/** A scene save is validated; any other save passes through unchanged. */
function acceptedPlanChanges(changes: UpdatePlanChanges): UpdatePlanChanges {
  if (changes.scene === undefined) return changes;
  return { ...changes, scene: acceptedScene(changes.scene) };
}

/**
 * The layout a save leaves in place for the seating rule, and, when the save changes the layout, the before and after
 * to compare for new seats. A scene save compares the stored scene's tables with the saved ones by the same ids.
 */
type SeatingLayouts = {
  next: readonly TableEligibilityObject[];
  newSeats?: { previous: readonly TableEligibilityObject[]; next: readonly TableEligibilityObject[] };
};

function seatingLayouts(plan: PlanRow, scene: FloorplanSceneDocument): SeatingLayouts {
  const next = sceneTableEligibilityObjects(scene);
  return { next, newSeats: { previous: sceneTableEligibilityObjects(storedScene(plan)), next } };
}

/** A plan row with the draft it belongs to, if any. */
type PlanRow = Prisma.FloorPlanGetPayload<{
  include: { opsDraft: { select: { eventId: true; sourceType: true; status: true } } };
}>;

type PlanWriteState = {
  updatedAt: Date;
  eventId: string | null;
  opsDraft: { eventId: string; sourceType: string; status: string } | null;
};

function isPrismaRecordMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function isPrismaSerializationFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

type EventPrivacy = 'private' | 'public';
/** A plan as PMCM and client readers see it: the owning event's privacy decides whether seating is open. */
type PlanView = FloorPlan & { eventPrivacy: EventPrivacy };

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(FLOORPLAN_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: FloorplanEventReferenceReader,
    @Inject(FLOORPLAN_SEATING_FACTS) private readonly seatingFacts: FloorplanSeatingFactsReader,
  ) {}

  private mapPlan(row: PlanRow, eventPrivacy: EventPrivacy): PlanView {
    return {
      id: row.id,
      name: row.name,
      venue: row.venue,
      width: row.width,
      height: row.height,
      gridSize: row.gridSize,
      pax: row.pax,
      eventPrivacy,
      ownerId: row.ownerId,
      templateId: row.templateId,
      eventId: row.eventId,
      scene: storedScene(row),
      sceneFormat: row.sceneFormat ?? storedScene(row).format,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPlan(planId: string, actor: ResolvedEventOpsActor): Promise<PlanView> {
    const row = await this.findPlan(planId);

    if (!row) throw new NotFoundException('Plan not found');
    await this.assertCanReadPlan(row, actor);

    return this.mapPlan(row, await this.eventPrivacyOf(row.eventId));
  }

  /** A plan with no event is never private, so seating on it stays closed. */
  private async eventPrivacyOf(eventId: string | null): Promise<EventPrivacy> {
    if (!eventId) return 'public';
    const reference = await this.lifecycleEventReferences.findFloorplanEvent(eventId);
    return reference?.eventPrivacy ?? 'public';
  }

  async updatePlan(
    planId: string,
    changes: UpdatePlanInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PlanView> {
    const plan = await this.findPlan(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const { expectedUpdatedAt: expectedUpdatedAtInput, ...requestedChanges } = changes;
    const expectedUpdatedAt = new Date(expectedUpdatedAtInput);
    const updated = await this.prisma.$transaction(async (tx) => {
      const stateBeforeLocks = await tx.floorPlan.findUnique({
        where: { id: planId },
        select: { id: true, name: true, eventId: true, updatedAt: true, opsDraft: { select: { eventId: true } } },
      });
      if (!stateBeforeLocks) throw new NotFoundException('Plan not found');
      const eventIdBeforeLocks = stateBeforeLocks.opsDraft?.eventId ?? stateBeforeLocks.eventId;
      const lifecycleEvent = await this.lifecycleEventForUpdate(tx, planId, eventIdBeforeLocks);

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
      const accepted = acceptedPlanChanges(requestedChanges);
      if (actor.role === OpsUserRole.Client && accepted.scene) assertClientSceneLeavesSeatingToPmcm(accepted.scene);
      const rosterGuests = await this.sceneSaveRoster(tx, eventIdAfterLocks, accepted);
      this.assertTableAssignmentsEligible(latestPlan, accepted, actor, lifecycleEvent?.eventPrivacy ?? 'public', rosterGuests);

      const saved = await this.savePlanChanges(tx, planId, accepted, expectedUpdatedAt);

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

    return this.mapPlan(updated, await this.eventPrivacyOf(plan.opsDraft?.eventId ?? plan.eventId));
  }

  /**
   * Official PMCM saves that change the layout must keep every seat assignment eligible, and may only add seats where the
   * event allows seating. Client preference saves carry no guest roster, so they are not checked here.
   */
  private assertTableAssignmentsEligible(plan: PlanRow, changes: UpdatePlanChanges, actor: ResolvedEventOpsActor, eventPrivacy: EventPrivacy, rosterGuests: FloorplanSeatingGuest[] | null) {
    if (actor.role === OpsUserRole.Client || !changes.scene || !rosterGuests) return;
    const layouts = seatingLayouts(plan, changes.scene);
    assertTableAssignmentsEligible(layouts.next, rosterGuests);
    if (layouts.newSeats) {
      assertSeatingAllowedForNewAssignments(layouts.newSeats.previous, layouts.newSeats.next, { pax: changes.pax ?? plan.pax, eventPrivacy });
    }
  }

  /**
   * A scene save seats guests from the event roster and gives zones only to suppliers booked on the event; a legacy
   * save (null here) keeps checking the plan's own guest list.
   */
  private async sceneSaveRoster(tx: Prisma.TransactionClient, eventId: string | null, changes: UpdatePlanChanges): Promise<FloorplanSeatingGuest[] | null> {
    if (!changes.scene) return null;
    const zoneSuppliers = zoneSupplierIds(changes.scene);
    if (!eventId) {
      if (zoneSuppliers.length) throw new BadRequestException(ZONE_SUPPLIER_MESSAGE);
      return [];
    }
    const [guests, booked] = await Promise.all([
      this.seatingFacts.listSeatingGuests(eventId, tx),
      zoneSuppliers.length ? this.seatingFacts.bookedSupplierIds(eventId, tx) : Promise.resolve(new Set<string>()),
    ]);
    if (zoneSuppliers.some((id) => !booked.has(id))) throw new BadRequestException(ZONE_SUPPLIER_MESSAGE);
    return guests;
  }

  /** The Lifecycle event a plan update locks against; a plan with no event has none. */
  private async lifecycleEventForUpdate(tx: Prisma.TransactionClient, planId: string, eventId: string | null) {
    if (!eventId) return null;
    const event = await this.lifecycleEventReferences.findFloorplanEvent(eventId, { prisma: tx, correlationId: `floorplan-plan-update:${planId}` });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async savePlanChanges(
    tx: Prisma.TransactionClient,
    planId: string,
    changes: UpdatePlanChanges,
    expectedUpdatedAt: Date,
  ): Promise<PlanRow> {
    return tx.floorPlan
      .update({
        where: { id: planId, updatedAt: expectedUpdatedAt },
        data: floorPlanScalarPatch(changes),
        include: { opsDraft: { select: { eventId: true, sourceType: true, status: true } } },
      })
      .catch((error: unknown) => {
        if (isPrismaRecordMissing(error)) {
          throw new ConflictException('Floorplan changed since it was loaded; reload before saving');
        }
        throw error;
      });
  }

  private async assertCanReadPlan(plan: PlanRow, actor: ResolvedEventOpsActor) {
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
    plan: PlanRow,
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
    plan: PlanRow,
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
    plan: PlanRow,
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
    // A client's only write is their layout: the scene, on a preference PMCM has reopened for revision.
    const forbiddenFields = Object.keys(changes).filter((field) => field !== 'scene');
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
        opsDraft: { select: { eventId: true, sourceType: true, status: true } },
      },
    });
  }
}
