import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OpsFileRequirement, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole, type OpsUserRole as OpsUserRoleValue } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { STORED_REQUIREMENT_UPLOAD_READER, type StoredRequirementUploadReader, type StoredRequirementUploadReference } from '@prism/contexts/platform-ops';
import {
  DERIVED_FILE_REQUIREMENT_KEYS,
  type CreateFileRequirementInput,
  type FileRequirementTemplateItemInput,
  type PrismFileRequirementItem,
  type PrismFileRequirementTemplate,
  type UpsertFileRequirementTemplateInput,
  type UpdateFileRequirementInput,
  type BindFileRequirementUploadInput,
} from '@prism/types';
import type { FileRequirementCommands, FileRequirementReminder, FileRequirementReminderReason } from '../../contracts/file-requirement-commands.port';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';
import { readEventAccessScope, scopeActorToEvent } from '@prism/contexts/read-models/event-scope';

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

function normalizeEventType(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

/** Omitted keeps the current due date, null clears it, and a string sets it. */
function nextDueAt(dueAt: string | null | undefined, currentDueDate: PrismFileRequirementItem['dueDate']): Date | null {
  if (dueAt === undefined) return currentDueDate ? new Date(currentDueDate) : null;
  return dueAt === null ? null : new Date(dueAt);
}

/** Merges the PMCM edit onto the current item. Derived labels are fixed, and PMCM plus the owner must stay visible. */
function overridePatch(input: UpdateFileRequirementInput, current: PrismFileRequirementItem, existing: OpsFileRequirement | null) {
  if (input.label !== undefined && current.origin !== 'custom') {
    throw new BadRequestException('Workflow-derived requirement labels follow their source workflow');
  }
  const next = {
    label: input.label ?? current.label,
    ownerRole: input.ownerRole ?? current.ownerRole,
    visibleToRoles: input.visibleToRoles ?? current.visibleToRoles,
    required: input.required ?? current.required,
    dueAt: nextDueAt(input.dueAt, current.dueDate),
    notes: input.notes === undefined ? (existing?.notes ?? null) : (input.notes || null),
  };
  if (!next.visibleToRoles.includes(OpsUserRole.PmcmAdmin) || !next.visibleToRoles.includes(next.ownerRole)) {
    throw new BadRequestException('PMCM and the owner role must both be able to see the requirement');
  }
  return next;
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
    @Inject(STORED_REQUIREMENT_UPLOAD_READER) private readonly storedRequirementUploads: StoredRequirementUploadReader,
  ) {}

  async createRequirement(eventId: string, input: CreateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    if ((DERIVED_FILE_REQUIREMENT_KEYS as readonly string[]).includes(input.key)) {
      throw new ConflictException('Workflow-derived requirements already exist; edit them instead of creating a duplicate');
    }
    try {
      return await this.writeRequirement(async (tx) => {
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
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A file requirement with this key already exists for the event');
      throw error;
    }
  }

  async updateRequirement(eventId: string, key: string, input: UpdateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    try {
      return await this.writeRequirement((tx) => this.applyUpdate(tx, eventId, key, input, actor));
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('File requirement changed; refresh before saving');
      throw error;
    }
  }

  async listRequirementTemplates(actor: ResolvedEventOpsActor): Promise<PrismFileRequirementTemplate[]> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'file requirement template management');
    const rows = await this.prisma.opsFileRequirementTemplate.findMany({ orderBy: { eventType: 'asc' }, take: 200 });
    return rows.map((row) => this.mapRequirementTemplate(row));
  }

  async upsertRequirementTemplate(input: UpsertFileRequirementTemplateInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementTemplate> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'file requirement template management');
    const eventType = normalizeEventType(input.eventType);
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.opsFileRequirementTemplate.findUnique({ where: { eventType } });
      const saved = await tx.opsFileRequirementTemplate.upsert({
        where: { eventType },
        create: { id: `frt_${randomUUID()}`, eventType, requirements: input.requirements as unknown as Prisma.InputJsonValue, updatedBy: actor.id ?? actor.name },
        update: { requirements: input.requirements as unknown as Prisma.InputJsonValue, updatedBy: actor.id ?? actor.name, revision: { increment: 1 } },
      });
      await writeAudit(this.auditWriter, undefined, actor.name, existing ? 'Updated event file requirement template' : 'Created event file requirement template', {
        actorRole: actor.role, actorEmail: actor.email, actionType: existing ? AuditActionType.Update : AuditActionType.Create,
        category: AuditCategory.Documents, affectedType: 'file_requirement_template', affectedId: saved.id, affectedLabel: eventType,
        metadata: { eventType, requirementCount: input.requirements.length, revision: saved.revision },
      }, { prisma: tx, correlationId: `file-requirement-template:${eventType}:r${saved.revision}` });
      return saved;
    });
    return this.mapRequirementTemplate(row);
  }

  async applyRequirementTemplate(eventId: string, actor: ResolvedEventOpsActor) {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'apply file requirement template', eventId);
    return this.writeRequirement(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { eventType: true } } } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived) throw new BadRequestException('Archived event file requirements are read-only');
      const eventType = normalizeEventType(event.inquiry.eventType);
      const template = await tx.opsFileRequirementTemplate.findUnique({ where: { eventType } });
      if (!template) throw new NotFoundException(`No file requirement template is configured for ${event.inquiry.eventType}`);
      const requirements = template.requirements as unknown as FileRequirementTemplateItemInput[];
      const existing = await tx.opsFileRequirement.findMany({ where: { eventId }, select: { key: true } });
      const existingKeys = new Set(existing.map(({ key }) => key));
      const created: string[] = [];
      for (const requirement of requirements) {
        if (existingKeys.has(requirement.key)) continue;
        const dueAt = requirement.dueOffsetDays === undefined ? null : new Date(event.eventDate);
        if (dueAt && requirement.dueOffsetDays !== undefined) dueAt.setUTCDate(dueAt.getUTCDate() - requirement.dueOffsetDays);
        const row = await tx.opsFileRequirement.create({ data: {
          id: `freq_${randomUUID()}`, eventId, key: requirement.key, label: requirement.label, ownerRole: requirement.ownerRole,
          visibleToRoles: requirement.visibleToRoles, required: requirement.required, dueAt, sourceWorkflow: 'custom', isCustom: true,
          notes: requirement.notes ?? null, updatedBy: actor.id ?? actor.name,
        } });
        await this.audit(tx, actor, row, 'Applied event file requirement template', AuditActionType.Create, { eventType, templateId: template.id });
        created.push(row.key);
      }
      return { eventId, eventType, templateId: template.id, createdKeys: created, skippedExistingCount: requirements.length - created.length };
    });
  }

  async bindRequirementUpload(eventId: string, key: string, input: BindFileRequirementUploadInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.writeRequirement(async (tx) => {
      const eventScope = await readEventAccessScope(tx, eventId);
      if (!eventScope) throw new NotFoundException('Event not found');
      const scoped = scopeActorToEvent(actor, eventScope);
      await this.accessPolicy.requireCanReadEvent(scoped.actor, eventScope, 'fulfil file requirement', scoped.scope);
      const scopedActor = scoped.actor;
      const requirement = await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key } } });
      if (!requirement || !requirement.isCustom) throw new NotFoundException('Custom file requirement not found');
      await this.accessPolicy.requireActorRole(scopedActor, [requirement.ownerRole as OpsUserRoleValue, OpsUserRole.PmcmAdmin], 'fulfil file requirement', eventId);
      if (!requirement.visibleToRoles.includes(scopedActor.role) && scopedActor.role !== OpsUserRole.PmcmAdmin) {
        throw new BadRequestException('This role cannot fulfil the file requirement');
      }
      const object = await this.requireBindingUpload(tx, eventId, key, input.objectId, scopedActor, requirement);
      const currentBinding = await tx.opsDocument.findFirst({ where: { eventId, storageKey: object.id } });
      if (currentBinding) {
        if (currentBinding.type !== key) throw new ConflictException('This upload already fulfils another file requirement');
        return;
      }
      await this.requireWritableEvent(eventId, tx);
      await tx.opsDocument.create({ data: {
        id: `doc_${randomUUID()}`, eventId, type: key, fileName: object.originalFileName, status: 'submitted',
        mimeType: object.contentType, sizeBytes: object.declaredByteSize, validationStatus: 'accepted',
        storageBucket: 'prism-storage', storageKey: object.id, uploadedByRole: scopedActor.role, uploadedAt: new Date(),
      } });
      await writeAudit(this.auditWriter, eventId, scopedActor.name, 'Bound stored upload to file requirement', {
        actorRole: scopedActor.role, actorEmail: scopedActor.email, actionType: AuditActionType.Create, category: AuditCategory.Documents,
        affectedType: 'file_requirement', affectedId: requirement.id, affectedLabel: key,
        metadata: { objectId: object.id, originalFileName: object.originalFileName, uploaderActorRole: object.uploaderActorRole },
      }, { prisma: tx, correlationId: `file-requirement-upload:${eventId}:${key}:${object.id}` });
    });
    const item = await this.itemFor(eventId, key, this.prisma as unknown as Prisma.TransactionClient);
    if (actor.role === OpsUserRole.PmcmAdmin) return item;
    const visible = { ...item };
    delete visible.notes;
    return visible;
  }

  private isRequirementUploadOwner(object: StoredRequirementUploadReference, eventId: string, actor: ResolvedEventOpsActor) {
    return ((object.usage === 'client_document' || object.usage === 'signed_conforme') && object.ownerRecordType === 'event' && object.ownerRecordId === eventId)
        || (object.usage === 'supplier_document' && object.ownerRecordType === 'supplier' && object.ownerRecordId === actor.supplierId)
        || (object.usage === 'event_deliverable' && ['billing_statement', 'proposal_version'].includes(object.ownerRecordType));
  }

  private async requireBindingUpload(tx: Prisma.TransactionClient, eventId: string, key: string, objectId: string, scopedActor: ResolvedEventOpsActor, requirement: OpsFileRequirement) {
    const object = await this.storedRequirementUploads.findStoredRequirementUpload({ eventId, objectId, context: { prisma: tx, correlationId: `file-requirement-upload:${eventId}:${key}:${objectId}` } });
    if (!object || object.lifecycleState !== 'stored' || object.eventId !== eventId) throw new BadRequestException('Upload must be stored for this event before it can fulfil a requirement');
    if (!this.isRequirementUploadOwner(object, eventId, scopedActor)) throw new BadRequestException('Upload owner does not match an allowed event requirement source');
    if (scopedActor.role !== OpsUserRole.PmcmAdmin && (object.uploaderActorRole !== requirement.ownerRole || object.uploaderActorId !== scopedActor.id)) {
      await this.accessPolicy.recordForbiddenAccess(scopedActor, 'fulfil file requirement with another uploader file', eventId);
      throw new BadRequestException('Only the requirement owner can bind their uploaded file');
    }
    return object;
  }

  private mapRequirementTemplate(row: { id: string; eventType: string; requirements: unknown; revision: number; updatedAt: Date }): PrismFileRequirementTemplate {
    return {
      id: row.id, eventType: row.eventType, requirements: row.requirements as FileRequirementTemplateItemInput[],
      revision: row.revision, updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async writeRequirement<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2034') throw error;
        if (attempt >= 2) throw new ConflictException('File requirements changed while saving; refresh and try again');
      }
    }
  }

  private async applyUpdate(
    tx: Prisma.TransactionClient,
    eventId: string,
    key: string,
    input: UpdateFileRequirementInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismFileRequirementItem> {
    await this.requireWritableEvent(eventId, tx);
    const current = (await this.matrix.buildForEvent(eventId, tx)).items.find((item) => item.key === key);
    if (!current) throw new NotFoundException('File requirement not found');
    const existing = await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key } } });
    if (input.expectedRevision !== undefined && input.expectedRevision !== (existing?.revision ?? 0)) {
      throw new ConflictException('File requirement changed; refresh before saving');
    }
    const next = overridePatch(input, current, existing);
    const row = await this.saveOverride(tx, eventId, key, current, existing, next, actor);
    await this.auditUpdate(tx, actor, row, input, current);
    return this.itemFor(eventId, key, tx);
  }

  private async auditUpdate(
    tx: Prisma.TransactionClient,
    actor: ResolvedEventOpsActor,
    row: OpsFileRequirement,
    input: UpdateFileRequirementInput,
    current: PrismFileRequirementItem,
  ) {
    const changed = (['label', 'ownerRole', 'required', 'dueAt', 'notes'] as const).filter((field) => input[field] !== undefined);
    await this.audit(tx, actor, row, 'Updated file requirement', AuditActionType.Update, {
      changedFields: changed, ownerRole: row.ownerRole, required: row.required, dueAt: row.dueAt?.toISOString() ?? null,
    });
    if (input.visibleToRoles && !sameRoles(input.visibleToRoles, current.visibleToRoles)) {
      await this.audit(tx, actor, row, 'Changed file requirement visibility', AuditActionType.Update, {
        previousVisibleToRoles: current.visibleToRoles, visibleToRoles: row.visibleToRoles,
      }, 'visibility');
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
      rejectedDocuments.forEach((document) => { if (!rejectedByType.has(document.type)) rejectedByType.set(document.type, document.id); });
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

  async sendReminders(eventId: string, actor: ResolvedEventOpsActor, now = new Date()): Promise<{ reminders: FileRequirementReminder[] }> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived event file requirements are read-only');
    const [matrix, rejectedDocuments] = await Promise.all([
      this.matrix.buildForEvent(eventId, this.prisma, now),
      this.prisma.opsDocument.findMany({
        where: { eventId, validationStatus: 'rejected' },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
        select: { id: true, type: true }, take: 200,
      }),
    ]);
    const rejectedByType = new Map<string, string>();
    rejectedDocuments.forEach((document) => { if (!rejectedByType.has(document.type)) rejectedByType.set(document.type, document.id); });
    const reminders: FileRequirementReminder[] = [];
    for (const item of matrix.items.filter((candidate) => candidate.required)) {
      const reasons: Array<[FileRequirementReminderReason, string]> = [];
      if (item.overdue && item.dueDate) reasons.push(['overdue', item.dueDate]);
      const rejectedId = item.validationStatus === 'rejected' ? rejectedByType.get(item.key) : undefined;
      if (rejectedId) reasons.push(['rejected', rejectedId]);
      for (const [reason, anchor] of reasons) reminders.push(...await this.queueReminder(eventId, item, reason, anchor));
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
