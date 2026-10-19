import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OpsFileRequirement, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import {
  DERIVED_FILE_REQUIREMENT_KEYS,
  type CreateFileRequirementInput,
  type PrismFileRequirementItem,
  type UpdateFileRequirementInput,
} from '@prism/types';
import type { FileRequirementCommands, FileRequirementReminder, FileRequirementReminderReason } from '../../contracts/file-requirement-commands.port';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';

const MANAGEMENT_RESOURCE = 'file requirement management';
const SWEEP_EVENT_LIMIT = 100;

/** Outbox recipient labels used by role-addressed PMCM notifications elsewhere in the API. */
const ROLE_RECIPIENT: Record<string, string> = {
  'pmcm-admin': 'PMCM Admin',
  client: 'Client',
  supplier: 'Supplier',
  coordinator: 'Coordinator',
};

function sameRoles(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().join(',') === [...right].sort().join(',');
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class FileRequirementCommandsService implements FileRequirementCommands {
  private readonly logger = new Logger(FileRequirementCommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: FileRequirementsMatrixService,
    private readonly accessPolicy: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  async createRequirement(eventId: string, input: CreateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    if ((DERIVED_FILE_REQUIREMENT_KEYS as readonly string[]).includes(input.key)) {
      throw new ConflictException('Workflow-derived requirements already exist; edit them instead of creating a duplicate');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.requireWritableEvent(eventId, tx);
        if (await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key: input.key } } })) {
          throw new ConflictException('A file requirement with this key already exists for the event');
        }
        const row = await tx.opsFileRequirement.create({
          data: {
            id: `freq_${randomUUID()}`, eventId, key: input.key, label: input.label, ownerRole: input.ownerRole,
            visibleToRoles: input.visibleToRoles, required: input.required, dueAt: input.dueAt ? new Date(input.dueAt) : null,
            sourceWorkflow: input.sourceWorkflow, isCustom: true, notes: input.notes || null, updatedBy: actor.id ?? actor.name,
          },
        });
        await this.audit(tx, actor, row, 'Created file requirement', AuditActionType.Create, {
          ownerRole: row.ownerRole, visibleToRoles: row.visibleToRoles, required: row.required,
          dueAt: row.dueAt?.toISOString() ?? null, sourceWorkflow: row.sourceWorkflow,
        });
        return this.itemFor(eventId, row.key, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A file requirement with this key already exists for the event');
      throw error;
    }
  }

  async updateRequirement(eventId: string, key: string, input: UpdateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.requireWritableEvent(eventId, tx);
        const current = (await this.matrix.buildForEvent(eventId, tx)).items.find((item) => item.key === key);
        if (!current) throw new NotFoundException('File requirement not found');
        const existing = await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key } } });
        const currentRevision = existing?.revision ?? 0;
        if (input.expectedRevision !== undefined && input.expectedRevision !== currentRevision) {
          throw new ConflictException('File requirement changed; refresh before saving');
        }
        if (input.label !== undefined && current.origin !== 'custom') {
          throw new BadRequestException('Workflow-derived requirement labels follow their source workflow');
        }
        const next = {
          label: input.label ?? current.label,
          ownerRole: input.ownerRole ?? current.ownerRole,
          visibleToRoles: input.visibleToRoles ?? current.visibleToRoles,
          required: input.required ?? current.required,
          dueAt: input.dueAt === undefined ? (current.dueDate ? new Date(current.dueDate) : null) : input.dueAt === null ? null : new Date(input.dueAt),
          notes: input.notes === undefined ? (existing?.notes ?? null) : (input.notes || null),
        };
        if (!next.visibleToRoles.includes(OpsUserRole.PmcmAdmin) || !next.visibleToRoles.includes(next.ownerRole)) {
          throw new BadRequestException('PMCM and the owner role must both be able to see the requirement');
        }
        const row = await this.saveOverride(tx, eventId, key, current, existing, next, actor);
        const changed = (['label', 'ownerRole', 'required', 'dueAt', 'notes'] as const).filter((field) => input[field] !== undefined);
        await this.audit(tx, actor, row, 'Updated file requirement', AuditActionType.Update, {
          changedFields: changed, ownerRole: row.ownerRole, required: row.required, dueAt: row.dueAt?.toISOString() ?? null,
        });
        if (input.visibleToRoles && !sameRoles(input.visibleToRoles, current.visibleToRoles)) {
          await this.audit(tx, actor, row, 'Changed file requirement visibility', AuditActionType.Update, {
            previousVisibleToRoles: current.visibleToRoles, visibleToRoles: row.visibleToRoles,
          }, 'visibility');
        }
        return this.itemFor(eventId, key, tx);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('File requirement changed; refresh before saving');
      throw error;
    }
  }

  async runReminderSweep(now = new Date()): Promise<{ reminders: FileRequirementReminder[] }> {
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        OR: [
          { fileRequirements: { some: { required: true, dueAt: { lte: now } } } },
          { documents: { some: { validationStatus: 'rejected' } } },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: SWEEP_EVENT_LIMIT,
    });
    const reminders: FileRequirementReminder[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: the source query limits this sweep to 100 events.
    for (const event of events) {
      const [matrix, rejectedDocuments] = await Promise.all([
        this.matrix.buildForEvent(event.id, this.prisma, now),
        this.prisma.opsDocument.findMany({
          where: { eventId: event.id, validationStatus: 'rejected' },
          orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
          select: { id: true, type: true },
          take: 200,
        }),
      ]);
      const rejectedByType = new Map<string, string>();
      for (const document of rejectedDocuments) if (!rejectedByType.has(document.type)) rejectedByType.set(document.type, document.id);
      for (const item of matrix.items.filter((candidate) => candidate.required)) {
        const reasons: Array<[FileRequirementReminderReason, string]> = [];
        if (item.overdue && item.dueDate) reasons.push(['overdue', item.dueDate]);
        const rejectedId = item.validationStatus === 'rejected' ? rejectedByType.get(item.key) : undefined;
        if (rejectedId) reasons.push(['rejected', rejectedId]);
        for (const [reason, anchor] of reasons) reminders.push(...await this.queueReminder(event.id, item, reason, anchor));
      }
    }
    return { reminders };
  }

  private async queueReminder(eventId: string, item: PrismFileRequirementItem, reason: FileRequirementReminderReason, anchor: string) {
    const message = reason === 'overdue'
      ? `Required file "${item.label}" is overdue (due ${anchor.slice(0, 10)}). Upload it in the event file hub.`
      : `Required file "${item.label}" was rejected. Upload a replacement in the event file hub.`;
    const roles = [...new Set([item.ownerRole, OpsUserRole.PmcmAdmin])];
    const queued: FileRequirementReminder[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most the owner role and PMCM.
    for (const role of roles) {
      const recipient = ROLE_RECIPIENT[role];
      if (!recipient) continue;
      // Stable per requirement revision and reason anchor, so repeated sweeps never duplicate outbox rows.
      const idempotencyKey = `file-requirement-${reason}:${eventId}:${item.key}:r${item.revision ?? 0}:${anchor}:${role}`;
      try {
        await writeNotification(this.notificationOutboxWriter, eventId, recipient, message, undefined, { idempotencyKey, correlationId: idempotencyKey });
        queued.push({ eventId, key: item.key, reason, recipient, idempotencyKey });
      } catch (error) {
        this.logger.warn(`File requirement reminder skipped for ${eventId}/${item.key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return queued;
  }

  private async saveOverride(
    tx: Prisma.TransactionClient,
    eventId: string,
    key: string,
    current: PrismFileRequirementItem,
    existing: OpsFileRequirement | null,
    next: { label: string; ownerRole: string; visibleToRoles: string[]; required: boolean; dueAt: Date | null; notes: string | null },
    actor: ResolvedEventOpsActor,
  ) {
    const updatedBy = actor.id ?? actor.name;
    if (!existing) {
      return tx.opsFileRequirement.create({
        data: {
          id: `freq_${randomUUID()}`, eventId, key, sourceWorkflow: current.sourceWorkflow, isCustom: false,
          label: next.label, ownerRole: next.ownerRole, visibleToRoles: next.visibleToRoles, required: next.required,
          dueAt: next.dueAt, notes: next.notes, updatedBy,
        },
      });
    }
    const updated = await tx.opsFileRequirement.updateMany({
      where: { id: existing.id, revision: existing.revision },
      data: { ...next, updatedBy, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ConflictException('File requirement changed; refresh before saving');
    return tx.opsFileRequirement.findUniqueOrThrow({ where: { id: existing.id } });
  }

  private async requireWritableEvent(eventId: string, tx: Prisma.TransactionClient) {
    const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived event file requirements are read-only');
  }

  private async itemFor(eventId: string, key: string, tx: Prisma.TransactionClient) {
    const item = (await this.matrix.buildForEvent(eventId, tx)).items.find((candidate) => candidate.key === key);
    if (!item) throw new NotFoundException('File requirement not found');
    return item;
  }

  /** Audit metadata stays structural: notes are PMCM-private and never copied into the audit chain. */
  private audit(
    tx: Prisma.TransactionClient,
    actor: ResolvedEventOpsActor,
    row: OpsFileRequirement,
    action: string,
    actionType: string,
    metadata: Record<string, unknown>,
    suffix = 'write',
  ) {
    return writeAudit(this.auditWriter, row.eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, actionType, category: AuditCategory.Documents,
      affectedType: 'file_requirement', affectedId: row.id, affectedLabel: row.key,
      metadata: { key: row.key, revision: row.revision, isCustom: row.isCustom, ...metadata },
    }, { prisma: tx, correlationId: `file-requirement-${suffix}:${row.id}:${row.revision}` });
  }
}
