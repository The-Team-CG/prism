import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OpsFileRequirement, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, scopeActorToEvent, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole, type OpsUserRole as OpsUserRoleValue } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { STORED_REQUIREMENT_UPLOAD_READER, type StoredRequirementUploadReader, type StoredRequirementUploadReference } from '@prism/contexts/platform-ops';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import {
  DERIVED_FILE_REQUIREMENT_KEYS,
  type CreateFileRequirementInput,
  type FileRequirementTemplateItemInput,
  type PrismFileRequirementItem,
  type PrismFileRequirementTemplate,
  type UpsertFileRequirementTemplateInput,
  type UpdateFileRequirementInput,
  type BindFileRequirementUploadInput,
  type ReviewRequirementFileInput,
} from '@prism/types';
import type { FileRequirementCommands, FileRequirementReminder, FileRequirementReminderReason } from '../../contracts/file-requirement-commands.port';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import { scopeFileRequirementItemsForActor, visibleFileRequirementItems } from '../../domain/file-requirement-matrix.policy';

const MANAGEMENT_RESOURCE = 'file requirement management';
const REMINDER_SWEEP_EVENT_PAGE_SIZE = 100;

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
    targetSupplierIds: input.targetSupplierIds ?? existing?.targetSupplierIds ?? [],
  };
  if (!next.visibleToRoles.includes(OpsUserRole.PmcmAdmin) || !next.visibleToRoles.includes(next.ownerRole)) {
    throw new BadRequestException('PMCM and the owner role must both be able to see the requirement');
  }
  return next;
}

const REMINDER_MESSAGES: Record<FileRequirementReminderReason, (label: string, date: string) => string> = {
  overdue: (label, date) => `Required file "${label}" is overdue (due ${date}). Upload it in the event file hub.`,
  rejected: (label) => `Required file "${label}" was rejected. Upload a replacement in the event file hub.`,
  expiring: (label, date) => `Required file "${label}" expires on ${date}. Upload a current one in the event file hub.`,
  expired: (label, date) => `Required file "${label}" expired on ${date}. Upload a current one in the event file hub.`,
};

/** Names only the requirement and the date or upload: the message never names another supplier. Dated anchors start with the date. */
function reminderMessage(reason: FileRequirementReminderReason, label: string, anchor: string) {
  return REMINDER_MESSAGES[reason](label, anchor.slice(0, 10));
}

/** Warn this long before a sent file stops being valid. */
const EXPIRY_WARNING_DAYS = 30;

/**
 * A file that was sent and not rejected but stops being valid soon, or already has. The anchor carries the date and
 * the file, so each warning is sent once, and again only if the file or its date changes.
 */
function expiryReason(objectId: string | undefined, status: string, expiries: ReadonlyMap<string, Date>, now: Date): [FileRequirementReminderReason, string] | null {
  const expiresAt = objectId && status !== 'missing' ? expiries.get(objectId) : undefined;
  if (!expiresAt) return null;
  const anchor = `${expiresAt.toISOString().slice(0, 10)}:${objectId}`;
  if (expiresAt.getTime() < now.getTime()) return ['expired', anchor];
  return expiresAt.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000 ? ['expiring', anchor] : null;
}

/** The files currently standing for each requirement: the single owner's latest, or each supplier's latest. */
function currentFileIds(items: PrismFileRequirementItem[]) {
  return items
    .flatMap((item) => [item.uploadedObjectId, ...(item.supplierFulfilments ?? []).map((fulfilment) => fulfilment.uploadedObjectId)])
    .filter((objectId): objectId is string => Boolean(objectId));
}

type ReviewedFileOwner = { role: string; supplierId?: string };

/** Who sent the file PMCM is reviewing. It must still be that owner's latest upload and still waiting for review. */
function reviewedFileOwner(item: PrismFileRequirementItem, documentId: string): ReviewedFileOwner | undefined {
  if (item.origin !== 'custom') return undefined;
  if (item.ownerRole === OpsUserRole.Supplier) {
    const fulfilment = item.supplierFulfilments?.find((entry) => entry.uploadedAssetId === documentId && entry.status === 'submitted');
    return fulfilment ? { role: item.ownerRole, supplierId: fulfilment.supplierId } : undefined;
  }
  const waiting = item.ownerRole !== OpsUserRole.PmcmAdmin && item.uploadedAssetId === documentId && item.status === 'submitted';
  return waiting ? { role: item.ownerRole } : undefined;
}

function reviewMessage(label: string, input: ReviewRequirementFileInput) {
  return input.decision === 'approve'
    ? `PMCM approved your file for "${label}".`
    : `PMCM did not accept your file for "${label}" and needs a replacement. Reason: ${input.reason}`;
}

/** The upload a PMCM rejected reminder points at: the rejected supplier file for supplier-owned items, else the latest rejected file of the type. */
function rejectedAnchor(item: PrismFileRequirementItem, rejectedByType: Map<string, string>) {
  if (item.supplierFulfilments) return item.supplierFulfilments.find((fulfilment) => fulfilment.validationStatus === 'rejected' || fulfilment.reviewReason)?.uploadedAssetId;
  return item.validationStatus === 'rejected' ? rejectedByType.get(item.key) : undefined;
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
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly accountContacts: AccountContactReadModel,
  ) {}

  async createRequirement(eventId: string, input: CreateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    if ((DERIVED_FILE_REQUIREMENT_KEYS as readonly string[]).includes(input.key)) {
      throw new ConflictException('Workflow-derived requirements already exist; edit them instead of creating a duplicate');
    }
    try {
      return await this.writeRequirement(async (tx) => {
        await this.requireWritableEvent(eventId, tx);
        await this.validateSupplierTargets(tx, eventId, input.ownerRole, true, input.targetSupplierIds ?? []);
        if (await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key: input.key } } })) {
          throw new ConflictException('A file requirement with this key already exists for the event');
        }
        const row = await tx.opsFileRequirement.create({
          data: {
            id: `freq_${randomUUID()}`, eventId, key: input.key, label: input.label, ownerRole: input.ownerRole,
            visibleToRoles: input.visibleToRoles, required: input.required, dueAt: input.dueAt ? new Date(input.dueAt) : null,
            sourceWorkflow: input.sourceWorkflow, isCustom: true, notes: input.notes || null, updatedBy: actor.id ?? actor.name,
            targetSupplierIds: input.targetSupplierIds ?? [],
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
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: the event-type template is a short PMCM-configured list, applied once per event.
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
    const responseActor = await this.writeRequirement(async (tx) => {
      const eventScope = await readEventAccessScope(tx, eventId);
      if (!eventScope) throw new NotFoundException('Event not found');
      const scoped = scopeActorToEvent(actor, eventScope);
      await this.accessPolicy.requireCanReadEvent(scoped.actor, eventScope, 'fulfil file requirement', scoped.scope);
      const scopedActor = scoped.actor;
      const requirement = await tx.opsFileRequirement.findUnique({ where: { eventId_key: { eventId, key } } });
      if (!requirement || !requirement.isCustom) throw new NotFoundException('Custom file requirement not found');
      await this.requireFulfilableRequirement(tx, eventId, requirement, scopedActor);
      const object = await this.requireBindingUpload(tx, eventId, key, input.objectId, scopedActor, requirement);
      const currentBinding = await tx.opsDocument.findFirst({ where: { eventId, storageKey: object.id } });
      if (currentBinding) {
        if (currentBinding.type !== key) throw new ConflictException('This upload already fulfils another file requirement');
        return scopedActor;
      }
      await this.requireWritableEvent(eventId, tx);
      const documentId = `doc_${randomUUID()}`;
      await tx.opsDocument.create({ data: {
        id: documentId, eventId, type: key, fileName: object.originalFileName, status: 'submitted',
        mimeType: object.contentType, sizeBytes: object.declaredByteSize, validationStatus: 'accepted',
        storageBucket: 'prism-storage', storageKey: object.id, uploadedByRole: scopedActor.role, uploadedAt: new Date(),
      } });
      await writeAudit(this.auditWriter, eventId, scopedActor.name, 'Bound stored upload to file requirement', {
        actorRole: scopedActor.role, actorEmail: scopedActor.email, actionType: AuditActionType.Create, category: AuditCategory.Documents,
        affectedType: 'file_requirement', affectedId: requirement.id, affectedLabel: key,
        metadata: { objectId: object.id, originalFileName: object.originalFileName, uploaderActorRole: object.uploaderActorRole },
      }, { prisma: tx, correlationId: `file-requirement-upload:${eventId}:${key}:${object.id}` });
      await this.replaceEarlierSubmissions(tx, eventId, key, documentId, scopedActor);
      if (scopedActor.role !== OpsUserRole.PmcmAdmin) await this.notifyPmcmOfSubmission(tx, eventId, requirement.label, object.originalFileName, documentId, scopedActor);
      return scopedActor;
    });
    const item = await this.itemFor(eventId, key, this.prisma as unknown as Prisma.TransactionClient, { role: responseActor.role, supplierId: responseActor.supplierId });
    // The response is shaped for the event-scoped actor so a supplier sees its own fulfilment only.
    const [scopedItem] = scopeFileRequirementItemsForActor(visibleFileRequirementItems([item], responseActor.role), responseActor);
    if (!scopedItem) throw new NotFoundException('File requirement not found');
    return scopedItem;
  }

  /**
   * A new upload replaces the sender's earlier files that PMCM has not reviewed yet, so only the newest one waits for
   * review. A supplier's files are matched to that supplier only.
   */
  private async replaceEarlierSubmissions(tx: Prisma.TransactionClient, eventId: string, key: string, documentId: string, sender: ResolvedEventOpsActor) {
    const item = await this.itemFor(eventId, key, tx);
    const versions = sender.role === OpsUserRole.Supplier
      ? item.supplierFulfilments?.find((fulfilment) => fulfilment.supplierId === sender.supplierId)?.versions
      : item.versions;
    const earlier = (versions ?? []).filter((version) => version.documentId !== documentId && version.status === 'submitted').map((version) => version.documentId);
    if (earlier.length) await tx.opsDocument.updateMany({ where: { id: { in: earlier }, eventId, type: key, status: 'submitted' }, data: { status: 'replaced' } });
  }

  /** Tells PMCM a client or supplier sent a file to review. */
  private notifyPmcmOfSubmission(tx: Prisma.TransactionClient, eventId: string, label: string, fileName: string, documentId: string, sender: ResolvedEventOpsActor) {
    const who = sender.role === OpsUserRole.Client ? 'The client' : sender.role === OpsUserRole.Supplier ? `Supplier ${sender.name}` : sender.name;
    const idempotencyKey = `file-requirement-submitted:${eventId}:${documentId}`;
    return writeNotification(this.notificationOutboxWriter, eventId, ROLE_RECIPIENT[OpsUserRole.PmcmAdmin]!, `${who} sent "${fileName}" for "${label}". It is waiting for your review.`, undefined,
      { idempotencyKey, correlationId: idempotencyKey, action: { kind: 'event_section', eventId, section: 'files' } },
      { prisma: tx, correlationId: idempotencyKey });
  }

  async reviewRequirementFile(eventId: string, key: string, input: ReviewRequirementFileInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    return this.writeRequirement(async (tx) => {
      await this.requireWritableEvent(eventId, tx);
      const owner = reviewedFileOwner(await this.itemFor(eventId, key, tx), input.documentId);
      if (!owner) throw new ConflictException('The submitted file changed; refresh before reviewing');
      const changed = await tx.opsDocument.updateMany({
        where: { id: input.documentId, eventId, type: key, status: 'submitted' },
        data: { status: input.decision === 'approve' ? 'approved' : 'rejected', rejectionReason: input.decision === 'reject' ? input.reason : null },
      });
      if (changed.count !== 1) throw new ConflictException('The submitted file changed; refresh before reviewing');
      await writeAudit(this.auditWriter, eventId, actor.name, 'Reviewed requirement file', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Documents,
        affectedType: 'document', affectedId: input.documentId, affectedLabel: key,
        metadata: { decision: input.decision, ownerRole: owner.role },
      }, { prisma: tx, correlationId: `requirement-file-review:${input.documentId}` });
      const reviewed = await this.itemFor(eventId, key, tx);
      await this.notifyReviewedFileOwner(tx, eventId, reviewed, input, owner);
      return reviewed;
    });
  }

  /** Tells whoever sent the file what PMCM decided, with the reason on a rejection. */
  private async notifyReviewedFileOwner(tx: Prisma.TransactionClient, eventId: string, item: PrismFileRequirementItem, input: ReviewRequirementFileInput, owner: ReviewedFileOwner) {
    const recipient = await this.reviewedFileRecipient(eventId, owner);
    if (!recipient) return;
    const anchor = `${eventId}:${item.key}:r${item.revision ?? 0}:${input.documentId}:${recipient.key}`;
    // A rejection uses the reminder sweep's key, so the sweep does not repeat a notice the decision already sent.
    const idempotencyKey = `file-requirement-${input.decision === 'approve' ? 'approved' : 'rejected'}:${anchor}`;
    await writeNotification(this.notificationOutboxWriter, eventId, recipient.address, reviewMessage(item.label, input), undefined,
      { idempotencyKey, correlationId: idempotencyKey, action: { kind: 'event_section', eventId, section: 'files' } },
      { prisma: tx, correlationId: idempotencyKey });
  }

  /** A role owner is addressed by role; a supplier at its own contact, so no other supplier hears about it. */
  private async reviewedFileRecipient(eventId: string, owner: ReviewedFileOwner): Promise<{ address: string; key: string } | undefined> {
    if (!owner.supplierId) {
      const address = ROLE_RECIPIENT[owner.role];
      return address ? { address, key: owner.role } : undefined;
    }
    const contacts = await this.accountContacts.findSelectedSupplierContacts(eventId);
    const email = contacts.find((contact) => contact.supplierId === owner.supplierId)?.email;
    if (email) return { address: email, key: `supplier:${owner.supplierId}` };
    this.logger.warn(`File review notice skipped for ${eventId}: supplier ${owner.supplierId} has no contact email`);
    return undefined;
  }

  private isRequirementUploadOwner(object: StoredRequirementUploadReference, eventId: string, actor: ResolvedEventOpsActor) {
    return ((object.usage === 'client_document' || object.usage === 'signed_conforme') && object.ownerRecordType === 'event' && object.ownerRecordId === eventId)
        || (object.usage === 'supplier_document' && object.ownerRecordType === 'supplier' && object.ownerRecordId === actor.supplierId)
        || (object.usage === 'event_deliverable' && ['billing_statement', 'proposal_version'].includes(object.ownerRecordType));
  }

  /** Suppliers may bind only when they hold a selected booking on the event; other roles pass through. */
  /** The role must own the requirement (or be PMCM), be allowed to see it, and, for a supplier, be booked and assigned to it. */
  private async requireFulfilableRequirement(tx: Prisma.TransactionClient, eventId: string, requirement: OpsFileRequirement, scopedActor: ResolvedEventOpsActor) {
    await this.accessPolicy.requireActorRole(scopedActor, [requirement.ownerRole as OpsUserRoleValue, OpsUserRole.PmcmAdmin], 'fulfil file requirement', eventId);
    if (!requirement.visibleToRoles.includes(scopedActor.role) && scopedActor.role !== OpsUserRole.PmcmAdmin) {
      throw new BadRequestException('This role cannot fulfil the file requirement');
    }
    await this.requireSelectedSupplierBooking(tx, eventId, scopedActor);
    await this.requireAssignedSupplier(requirement, eventId, scopedActor);
  }

  /** A requirement aimed at specific suppliers can be fulfilled only by one of them. */
  private async requireAssignedSupplier(requirement: OpsFileRequirement, eventId: string, scopedActor: ResolvedEventOpsActor) {
    if (scopedActor.role !== OpsUserRole.Supplier || requirement.targetSupplierIds.length === 0) return;
    if (scopedActor.supplierId && requirement.targetSupplierIds.includes(scopedActor.supplierId)) return;
    await this.accessPolicy.recordForbiddenAccess(scopedActor, 'fulfil unassigned file requirement', eventId);
    throw new ForbiddenException('This file requirement is not assigned to your supplier');
  }

  private async requireSelectedSupplierBooking(tx: Prisma.TransactionClient, eventId: string, scopedActor: ResolvedEventOpsActor) {
    if (scopedActor.role !== OpsUserRole.Supplier) return;
    // An unresolved supplierId must refuse outright: Prisma treats an undefined where-field as no filter.
    const selectedBooking = scopedActor.supplierId
      ? await tx.opsSupplierQuoteRequest.findFirst({ where: { eventId, supplierId: scopedActor.supplierId, status: 'selected' }, select: { id: true } })
      : null;
    if (selectedBooking) return;
    await this.accessPolicy.recordForbiddenAccess(scopedActor, 'fulfil file requirement without a selected booking', eventId);
    throw new ForbiddenException('Only a selected supplier on this event can fulfil this requirement');
  }

  private async requireBindingUpload(tx: Prisma.TransactionClient, eventId: string, key: string, objectId: string, scopedActor: ResolvedEventOpsActor, requirement: OpsFileRequirement) {
    const object = await this.storedRequirementUploads.findStoredRequirementUpload({ eventId, objectId, context: { prisma: tx, correlationId: `file-requirement-upload:${eventId}:${key}:${objectId}` } });
    if (!object || object.lifecycleState !== 'stored' || object.eventId !== eventId) throw new BadRequestException('Upload must be stored for this event before it can fulfil a requirement');
    if (!this.isRequirementUploadOwner(object, eventId, scopedActor)) throw new BadRequestException('Upload owner does not match an allowed event requirement source');
    if (scopedActor.role === OpsUserRole.Supplier && !object.logicalTarget.startsWith(`supplier-requirement:${key}:`)) {
      throw new BadRequestException('Upload was requested for a different file requirement');
    }
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
    if (input.targetSupplierIds !== undefined || input.ownerRole !== undefined) {
      await this.validateSupplierTargets(tx, eventId, next.ownerRole, current.origin === 'custom', next.targetSupplierIds);
    }
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
    const changed = (['label', 'ownerRole', 'required', 'dueAt', 'notes', 'targetSupplierIds'] as const).filter((field) => input[field] !== undefined);
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
    const reminders: FileRequirementReminder[] = [];
    let afterId: string | undefined;
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: keyset pages cover the complete eligible event set.
    while (true) {
      const events = await this.prisma.opsEvent.findMany({
        where: {
          archived: false,
          OR: [
            { fileRequirements: { some: { required: true, dueAt: { lte: now } } } },
            { documents: { some: { OR: [{ validationStatus: 'rejected' }, { status: 'rejected' }] } } },
          ],
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: REMINDER_SWEEP_EVENT_PAGE_SIZE,
      });
      if (events.length === 0) break;

      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one bounded page of events per iteration.
      for (const event of events) {
        try {
          reminders.push(...await this.queueEventReminders(event.id, now));
        } catch (error) {
          this.logger.warn(`File requirement reminder sweep failed for event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (events.length < REMINDER_SWEEP_EVENT_PAGE_SIZE) break;
      afterId = events[events.length - 1]!.id;
    }
    return { reminders };
  }

  /** Queues one event's reminders as of `now`; the sweep and PMCM's manual send both come through here. */
  private async queueEventReminders(eventId: string, now: Date): Promise<FileRequirementReminder[]> {
    const [matrix, rejectedDocuments, supplierContacts] = await Promise.all([
      this.matrix.buildForEvent(eventId, this.prisma, now),
      this.prisma.opsDocument.findMany({
        where: { eventId, OR: [{ validationStatus: 'rejected' }, { status: 'rejected' }] },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
        select: { id: true, type: true },
        take: 200,
      }),
      this.accountContacts.findSelectedSupplierContacts(eventId),
    ]);
    const rejectedByType = new Map<string, string>();
    rejectedDocuments.forEach((document) => { if (!rejectedByType.has(document.type)) rejectedByType.set(document.type, document.id); });
    const emailBySupplier = new Map(supplierContacts.map(({ supplierId, email }) => [supplierId, email]));
    const required = matrix.items.filter((candidate) => candidate.required);
    const expiries = await this.storedRequirementUploads.findStoredFileExpiries({ eventId, objectIds: currentFileIds(required) });
    const reminders: FileRequirementReminder[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one event's required items, each with at most three reasons.
    for (const item of required) {
      reminders.push(...await this.queueFulfilmentReminders(eventId, item, emailBySupplier, expiries, now));
      for (const [reason, anchor] of this.requirementReasons(item, rejectedByType, expiries, now)) {
        reminders.push(...await this.queueReminder(eventId, item, reason, anchor));
      }
    }
    return reminders;
  }

  /** Why a requirement owned by a single role needs a reminder: overdue, rejected, or its file expiring or expired. */
  private requirementReasons(item: PrismFileRequirementItem, rejectedByType: Map<string, string>, expiries: ReadonlyMap<string, Date>, now: Date) {
    const reasons: Array<[FileRequirementReminderReason, string]> = [];
    if (item.overdue && item.dueDate) reasons.push(['overdue', item.dueDate]);
    const rejectedId = rejectedAnchor(item, rejectedByType);
    if (rejectedId) reasons.push(['rejected', rejectedId]);
    const expiry = item.supplierFulfilments ? null : expiryReason(item.uploadedObjectId, item.status, expiries, now);
    if (expiry) reasons.push(expiry);
    return reasons;
  }

  async sendReminders(eventId: string, actor: ResolvedEventOpsActor, now = new Date()): Promise<{ reminders: FileRequirementReminder[] }> {
    await this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], MANAGEMENT_RESOURCE, eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived event file requirements are read-only');
    return { reminders: await this.queueEventReminders(eventId, now) };
  }

  /** Supplier-owned items remind each affected supplier at its own contact; a satisfied, unrejected supplier gets nothing. */
  private async queueFulfilmentReminders(eventId: string, item: PrismFileRequirementItem, emailBySupplier: Map<string, string | null>, expiries: ReadonlyMap<string, Date>, now: Date) {
    const reminders: FileRequirementReminder[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one fulfilment per selected supplier, each with at most three reasons.
    for (const fulfilment of item.supplierFulfilments ?? []) {
      const email = emailBySupplier.get(fulfilment.supplierId) ?? null;
      if (fulfilment.overdue && item.dueDate) reminders.push(...await this.queueSupplierReminder(eventId, item, 'overdue', item.dueDate, fulfilment.supplierId, email));
      if ((fulfilment.validationStatus === 'rejected' || fulfilment.reviewReason) && fulfilment.uploadedAssetId) {
        reminders.push(...await this.queueSupplierReminder(eventId, item, 'rejected', fulfilment.uploadedAssetId, fulfilment.supplierId, email));
      }
      const expiry = expiryReason(fulfilment.uploadedObjectId, fulfilment.status, expiries, now);
      if (expiry) reminders.push(...await this.queueSupplierReminder(eventId, item, expiry[0], expiry[1], fulfilment.supplierId, email));
    }
    return reminders;
  }

  /** Role-addressed reminder. Supplier-owned items reach PMCM only: the Supplier label would fan out to every selected supplier. */
  private async queueReminder(eventId: string, item: PrismFileRequirementItem, reason: FileRequirementReminderReason, anchor: string) {
    const roles = [...new Set([item.supplierFulfilments ? OpsUserRole.PmcmAdmin : item.ownerRole, OpsUserRole.PmcmAdmin])];
    const queued: FileRequirementReminder[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most the owner role and PMCM.
    for (const role of roles) {
      const recipient = ROLE_RECIPIENT[role];
      if (!recipient) continue;
      // Stable per requirement revision and reason anchor, so repeated sweeps never duplicate outbox rows.
      const idempotencyKey = `file-requirement-${reason}:${eventId}:${item.key}:r${item.revision ?? 0}:${anchor}:${role}`;
      queued.push(...await this.writeReminder(eventId, item, reason, anchor, recipient, idempotencyKey));
    }
    return queued;
  }

  /** One selected supplier's reminder, addressed to that supplier's own contact and keyed by supplier. */
  private async queueSupplierReminder(
    eventId: string,
    item: PrismFileRequirementItem,
    reason: FileRequirementReminderReason,
    anchor: string,
    supplierId: string,
    email: string | null,
  ): Promise<FileRequirementReminder[]> {
    if (!email) {
      this.logger.warn(`File requirement reminder skipped for ${eventId}/${item.key}: supplier ${supplierId} has no contact email`);
      return [];
    }
    const idempotencyKey = `file-requirement-${reason}:${eventId}:${item.key}:r${item.revision ?? 0}:${anchor}:supplier:${supplierId}`;
    return this.writeReminder(eventId, item, reason, anchor, email, idempotencyKey);
  }

  private async writeReminder(
    eventId: string,
    item: PrismFileRequirementItem,
    reason: FileRequirementReminderReason,
    anchor: string,
    recipient: string,
    idempotencyKey: string,
  ): Promise<FileRequirementReminder[]> {
    try {
      await writeNotification(this.notificationOutboxWriter, eventId, recipient, reminderMessage(reason, item.label, anchor), undefined, { idempotencyKey, correlationId: idempotencyKey, action: { kind: 'event_section', eventId, section: 'files' } });
      return [{ eventId, key: item.key, reason, recipient, idempotencyKey }];
    } catch (error) {
      this.logger.warn(`File requirement reminder skipped for ${eventId}/${item.key}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async saveOverride(
    tx: Prisma.TransactionClient,
    eventId: string,
    key: string,
    current: PrismFileRequirementItem,
    existing: OpsFileRequirement | null,
    next: { label: string; ownerRole: string; visibleToRoles: string[]; required: boolean; dueAt: Date | null; notes: string | null; targetSupplierIds: string[] },
    actor: ResolvedEventOpsActor,
  ) {
    const updatedBy = actor.id ?? actor.name;
    if (!existing) {
      return tx.opsFileRequirement.create({
        data: {
          id: `freq_${randomUUID()}`, eventId, key, sourceWorkflow: current.sourceWorkflow, isCustom: false,
          label: next.label, ownerRole: next.ownerRole, visibleToRoles: next.visibleToRoles, required: next.required,
          dueAt: next.dueAt, notes: next.notes, updatedBy,
          targetSupplierIds: next.targetSupplierIds,
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

  private async validateSupplierTargets(tx: Prisma.TransactionClient, eventId: string, ownerRole: string, isCustom: boolean, ids: string[]) {
    if (ids.length === 0) return;
    if (!isCustom || ownerRole !== OpsUserRole.Supplier) {
      throw new BadRequestException('Supplier targets are available only for custom supplier requirements');
    }
    const bookings = await tx.opsSupplierQuoteRequest.findMany({
      where: { eventId, status: 'selected', supplierId: { in: ids } }, select: { supplierId: true }, distinct: ['supplierId'], take: 200,
    });
    const selected = new Set(bookings.map((booking) => booking.supplierId));
    if (ids.some((id) => !selected.has(id))) throw new BadRequestException('Each target must be a selected supplier on this event');
  }

  private async itemFor(eventId: string, key: string, tx: Prisma.TransactionClient, audience?: { role: string; supplierId?: string | null }) {
    const item = (await this.matrix.buildForEvent(eventId, tx, undefined, audience)).items.find((candidate) => candidate.key === key);
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
