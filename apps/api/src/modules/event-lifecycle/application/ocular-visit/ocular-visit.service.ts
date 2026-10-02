import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OpsOcularVisitRequest, Prisma } from '@prisma/client';
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
  NOTIFICATION_OUTBOX_WRITER,
  type NotificationOutboxWriter,
  writeNotification,
} from '@prism/contexts/platform-ops';
import type {
  PrismClientOcularVisit,
  PrismOcularVisitStatus,
  PrismPmcmOcularVisit,
  ScheduleOcularVisitInput,
  SubmitClientOcularVisitInput,
  WaiveOcularVisitInput,
} from '@prism/types';
import { randomUUID } from 'node:crypto';

type OcularVisitEvent = Prisma.OpsEventGetPayload<{ include: { inquiry: true } }>;

const ocularVisitStatuses = new Set<PrismOcularVisitStatus>([
  'requested',
  'scheduled',
  'completed',
  'waived',
]);

@Injectable()
export class OcularVisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER)
    private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  async submitClientRequest(
    eventId: string,
    input: SubmitClientOcularVisitInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismClientOcularVisit> {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.Client],
      'client ocular visit request',
      eventId,
    );

    return this.prisma.$transaction(async (tx) => {
        const event = await this.requireEvent(tx, eventId);
        await this.eventAccessPolicyService.requireCanReadEvent(
          actor,
          event,
          'client ocular visit request',
        );
        if (!event.inquiry.conformeSignedAt) {
          throw new BadRequestException('A signed conforme is required before requesting an ocular visit');
        }

        const existing = await tx.opsOcularVisitRequest.findUnique({ where: { eventId } });
        if (existing) throw new ConflictException('An ocular visit request already exists');

        const requestedAt = new Date();
        const request = await this.createOcularVisitRequest(tx, {
          id: 'ocular_visit_' + randomUUID(),
          eventId,
          status: 'requested',
          clientNote: input.clientNote ?? null,
          requestedAt,
        });
        const context = { prisma: tx, correlationId: request.id };
        await writeAudit(
          this.auditWriter,
          eventId,
          actor.name,
          'Requested ocular visit',
          {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Events,
            actionType: AuditActionType.Create,
            affectedType: 'ocular_visit_request',
            affectedId: request.id,
            affectedLabel: 'Client ocular visit',
            metadata: {
              actorId: actor.id ?? null,
              clientNoteProvided: Boolean(input.clientNote),
            },
          },
          context,
        );
        return this.toClientView(request);
    }, { isolationLevel: 'Serializable' });
  }

  async scheduleOcularVisit(
    eventId: string,
    input: ScheduleOcularVisitInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismPmcmOcularVisit> {
    await this.requireAdmin(actor, eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(tx, eventId);
      const request = await tx.opsOcularVisitRequest.findUnique({ where: { eventId } });
      if (!request) throw new NotFoundException('Ocular visit request not found');
      if (request.status !== 'requested') {
        throw new BadRequestException('Only a requested ocular visit can be scheduled');
      }

      const saved = await tx.opsOcularVisitRequest.update({
        where: { eventId },
        data: { status: 'scheduled', scheduledAt: new Date(input.scheduledAt) },
      });
      const context = { prisma: tx, correlationId: saved.id };
      await writeAudit(
        this.auditWriter,
        eventId,
        actor.name,
        'Scheduled ocular visit',
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'ocular_visit_request',
          affectedId: saved.id,
          affectedLabel: 'Client ocular visit',
          metadata: { scheduledAt: saved.scheduledAt?.toISOString() ?? null, actorId: actor.id ?? null },
        },
        context,
      );
      await writeNotification(
        this.notificationOutboxWriter,
        eventId,
        event.inquiry.email,
        event.eventName + ' ocular visit scheduled for ' + input.scheduledAt,
        'email',
        { idempotencyKey: 'ocular-visit-scheduled:' + saved.id },
        context,
      );
      return this.toPmcmView(saved);
    }, { isolationLevel: 'Serializable' });
  }

  async completeOcularVisit(
    eventId: string,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismPmcmOcularVisit> {
    await this.requireAdmin(actor, eventId);
    return this.prisma.$transaction(async (tx) => {
      await this.requireEvent(tx, eventId);
      const request = await tx.opsOcularVisitRequest.findUnique({ where: { eventId } });
      if (!request) throw new NotFoundException('Ocular visit request not found');
      if (request.status !== 'scheduled') {
        throw new BadRequestException('Only a scheduled ocular visit can be completed');
      }

      const saved = await tx.opsOcularVisitRequest.update({
        where: { eventId },
        data: { status: 'completed', completedAt: new Date() },
      });
      const context = { prisma: tx, correlationId: saved.id };
      await writeAudit(
        this.auditWriter,
        eventId,
        actor.name,
        'Completed ocular visit',
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'ocular_visit_request',
          affectedId: saved.id,
          affectedLabel: 'Client ocular visit',
          metadata: { actorId: actor.id ?? null },
        },
        context,
      );
      return this.toPmcmView(saved);
    }, { isolationLevel: 'Serializable' });
  }

  async waiveOcularVisit(
    eventId: string,
    input: WaiveOcularVisitInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismPmcmOcularVisit> {
    await this.requireAdmin(actor, eventId);
    return this.prisma.$transaction(async (tx) => {
      await this.requireEvent(tx, eventId);
      const existing = await tx.opsOcularVisitRequest.findUnique({ where: { eventId } });
      if (existing && existing.status !== 'requested' && existing.status !== 'scheduled') {
        throw new BadRequestException('Only a requested or scheduled ocular visit can be waived');
      }

      const now = new Date();
      const saved = existing
        ? await tx.opsOcularVisitRequest.update({
            where: { eventId },
            data: {
              status: 'waived',
              waiverReason: input.reason,
              waivedAt: now,
              waivedBy: actor.name,
            },
          })
        : await this.createOcularVisitRequest(tx, {
            id: 'ocular_visit_' + randomUUID(),
            eventId,
            status: 'waived',
            clientNote: null,
            requestedAt: null,
            waiverReason: input.reason,
            waivedAt: now,
            waivedBy: actor.name,
          });

      const context = { prisma: tx, correlationId: saved.id };
      await writeAudit(
        this.auditWriter,
        eventId,
        actor.name,
        'Waived ocular visit',
        {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'ocular_visit_request',
          affectedId: saved.id,
          affectedLabel: 'Client ocular visit',
          metadata: { actorId: actor.id ?? null, reason: input.reason },
        },
        context,
      );
      return this.toPmcmView(saved);
    }, { isolationLevel: 'Serializable' });
  }

  private async createOcularVisitRequest(
    tx: Prisma.TransactionClient,
    data: Prisma.OpsOcularVisitRequestUncheckedCreateInput,
  ): Promise<OpsOcularVisitRequest> {
    try {
      return await tx.opsOcularVisitRequest.create({ data });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('An ocular visit record already exists');
      }
      throw error;
    }
  }

  private async requireEvent(tx: Prisma.TransactionClient, eventId: string): Promise<OcularVisitEvent> {
    const event = await tx.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireAdmin(actor: ResolvedEventOpsActor, eventId: string) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'PMCM ocular visit task',
      eventId,
    );
  }

  private toClientView(request: OpsOcularVisitRequest): PrismClientOcularVisit {
    return {
      eventId: request.eventId,
      status: this.readStatus(request.status),
      clientNote: request.clientNote,
      requestedAt: request.requestedAt?.toISOString() ?? null,
      scheduledAt: request.scheduledAt?.toISOString() ?? null,
    };
  }

  private toPmcmView(request: OpsOcularVisitRequest): PrismPmcmOcularVisit {
    return {
      ...this.toClientView(request),
      completedAt: request.completedAt?.toISOString() ?? null,
      waiverReason: request.waiverReason,
      waivedAt: request.waivedAt?.toISOString() ?? null,
      waivedBy: request.waivedBy,
    };
  }

  private readStatus(status: string): PrismOcularVisitStatus {
    if (!ocularVisitStatuses.has(status as PrismOcularVisitStatus)) {
      throw new BadRequestException('Ocular visit status is invalid');
    }
    return status as PrismOcularVisitStatus;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 'P2002',
    );
  }
}
