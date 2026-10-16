import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor, AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type {
  AcknowledgeSupplierScheduleInput,
  BindSupplierContractInput,
  CreateSupplierCreativeTaskInput,
  CreateSupplierPayableMilestoneInput,
  PrismPmcmSupplierWorkflowWorkspace,
  PrismSupplierContractVersion,
  PrismSupplierCreativeTask,
  PrismSupplierPayableMilestone,
  PrismSupplierWorkflowSchedule,
  PrismSupplierWorkflowWorkspace,
  ReleaseSupplierPayoutInput,
  RequestSupplierScheduleChangeInput,
  ReviewSupplierContractInput,
  ReverseSupplierPayoutInput,
  SubmitSupplierCreativeTaskInput,
  UpdateSupplierCreativeProgressInput,
  UpdateSupplierCreativeTaskInput,
} from '@prism/types';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import { STORED_SUPPLIER_UPLOAD_READER, type StoredSupplierUploadReader } from '@prism/contexts/platform-ops';

const contractTargetPrefix = (requestId: string) => `supplier-contract:${requestId}:`;
const creativeTargetPrefix = (requestId: string) => `supplier-creative:${requestId}:`;

type SupplierWorkflowLockTable = 'quote_requests' | 'supplier_schedules' | 'supplier_payable_milestones' | 'quotes' | 'supplier_creative_tasks';

async function lockRow(tx: PrismaTypes.TransactionClient, table: SupplierWorkflowLockTable, id: string) {
  await tx.$queryRaw`SELECT id FROM ${Prisma.raw(`"commercial"."${table}"`)} WHERE id = ${id} FOR UPDATE`; // QUERY_AUDIT_RAW_SQL: table name comes from a closed internal union; ID is parameterized.
}

async function lockActiveEvent(tx: PrismaTypes.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, eventReferences: OperationsEventReferenceReader) {
  if (actor.eventId && actor.eventId !== eventId) throw new ForbiddenException('Actor cannot access this event');
  const event = await eventReferences.findOperationsEvent(eventId, { prisma: tx, correlationId: `supplier-workflow-event:${eventId}` });
  if (!event || event.archived) throw new NotFoundException('Active event not found');
}

async function lockConfirmedSupplierAssignment(tx: PrismaTypes.TransactionClient, requestId: string, eventId: string, supplierId: string) {
  await lockRow(tx, 'quote_requests', requestId);
  const request = await tx.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
  if (!request || request.eventId !== eventId || request.supplierId !== supplierId || request.status !== 'selected' || request.assignmentStatus !== 'confirmed') {
    throw new BadRequestException('A confirmed supplier assignment is required');
  }
}

function payloadHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function netReleased(records: Array<{ kind: string; amount: number }>) {
  return records.reduce((total, record) => total + (record.kind === 'release' ? record.amount : -record.amount), 0);
}

function sameCreativeTaskInput(existing: { eventId: string; requestId: string; supplierId: string; title: string; brief: string; dueAt: Date | null }, eventId: string, supplierId: string, input: { requestId: string; title: string; brief: string; dueAt: Date | null }) {
  return existing.eventId === eventId && existing.requestId === input.requestId && existing.supplierId === supplierId &&
    existing.title === input.title && existing.brief === input.brief &&
    (existing.dueAt?.getTime() ?? null) === (input.dueAt?.getTime() ?? null);
}

function contractReviewStatus(status: string): PrismSupplierContractVersion['reviewStatus'] {
  if (status === 'submitted' || status === 'accepted' || status === 'changes_requested') return status;
  throw new BadRequestException('Unsupported supplier contract review state');
}

function creativeStatus(status: string): PrismSupplierCreativeTask['status'] {
  if (status === 'open' || status === 'in_progress' || status === 'submitted' || status === 'changes_requested' || status === 'accepted' || status === 'cancelled') return status;
  throw new BadRequestException('Unsupported supplier deliverable state');
}

function payableStatus(status: string): PrismSupplierPayableMilestone['status'] {
  if (status === 'scheduled' || status === 'partially_released' || status === 'released' || status === 'cancelled') return status;
  throw new BadRequestException('Unsupported supplier payable state');
}

@Injectable()
export class SupplierWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(STORED_SUPPLIER_UPLOAD_READER) private readonly storedSupplierUploads: StoredSupplierUploadReader,
  ) {}

  async supplierWorkspace(actor: ResolvedEventOpsActor): Promise<PrismSupplierWorkflowWorkspace> {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier workflows');
    const supplier = await this.resolveSupplier(actor);
    const [schedules, contracts, tasks, milestones] = await Promise.all([
      this.prisma.opsSupplierSchedule.findMany({ where: { request: { supplierId: supplier.id } }, orderBy: { ingressAt: 'asc' }, take: 250 }),
      this.prisma.opsSupplierContractVersion.findMany({ where: { supplierId: supplier.id }, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: 250 }),
      this.prisma.opsSupplierCreativeTask.findMany({ where: { supplierId: supplier.id }, include: { submissions: { orderBy: [{ version: 'desc' }, { id: 'desc' }] } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 250 }),
      this.prisma.opsSupplierPayableMilestone.findMany({ where: { supplierId: supplier.id, status: { not: 'cancelled' } }, include: { payouts: { orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] } }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], take: 250 }),
    ]);
    const activeEventIds = await this.activeEventIds([...schedules, ...contracts, ...tasks, ...milestones].map(({ eventId }) => eventId));
    return {
      schedules: schedules.filter(({ eventId }) => activeEventIds.has(eventId)).map((row) => this.mapSchedule(row)),
      contracts: contracts.filter(({ eventId }) => activeEventIds.has(eventId)).map((row) => this.mapContract(row)),
      creativeTasks: tasks.filter(({ eventId }) => activeEventIds.has(eventId)).map((task) => this.mapCreativeTask(task)),
      payables: milestones.filter(({ eventId }) => activeEventIds.has(eventId)).map((milestone) => this.mapPayable(milestone)),
    };
  }

  async bindContract(requestId: string, input: BindSupplierContractInput, actor: ResolvedEventOpsActor) {
    const { supplier, request } = await this.supplierRequest(requestId, actor);
    const object = await this.storedSupplierUploads.findConfirmedSupplierUpload({
      objectId: input.storedObjectId, eventId: request.eventId, supplierId: supplier.id,
      logicalTargetPrefix: contractTargetPrefix(request.id), checksumSha256: input.checksumSha256,
    });
    if (!object) {
      throw new BadRequestException('Uploaded contract is not a confirmed upload for this supplier assignment');
    }
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, request.eventId, actor, this.eventReferences);
      await lockRow(tx, 'quote_requests', requestId);
      const current = await tx.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
      if (!current || current.eventId !== request.eventId || current.supplierId !== supplier.id || current.status !== 'selected' || current.assignmentStatus !== 'confirmed') {
        throw new BadRequestException('Only a confirmed supplier assignment can receive a contract');
      }
      const existing = await tx.opsSupplierContractVersion.findUnique({ where: { storedObjectId: object.id } });
      if (existing) return this.mapContract(existing);
      const previous = await tx.opsSupplierContractVersion.findFirst({ where: { requestId }, orderBy: { version: 'desc' } });
      const created = await tx.opsSupplierContractVersion.create({ data: {
        id: `scv_${randomUUID()}`, eventId: request.eventId, requestId, supplierId: supplier.id,
        version: (previous?.version ?? 0) + 1, storedObjectId: object.id, fileName: object.originalFileName,
        mimeType: object.contentType, sizeBytes: object.declaredByteSize, checksumSha256: object.checksumSha256,
        reviewStatus: 'submitted',
      } });
      await writeAudit(this.auditWriter, request.eventId, actor.name, `Submitted supplier contract: ${request.supplierName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Upload, category: AuditCategory.Documents,
        affectedType: 'supplier_contract_version', affectedId: created.id, affectedLabel: created.fileName,
        metadata: { requestId, version: created.version, storedObjectId: object.id },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-contract:${requestId}:${object.id}` });
      return this.mapContract(created);
    });
  }

  async reviewContract(versionId: string, input: ReviewSupplierContractInput, actor: ResolvedEventOpsActor) {
    const existing = await this.prisma.opsSupplierContractVersion.findUnique({ where: { id: versionId } });
    if (!existing) throw new NotFoundException('Supplier contract version not found');
    await this.requirePmcm(actor, 'review supplier contract', existing.eventId);
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, existing.eventId, actor, this.eventReferences);
      await lockRow(tx, 'quote_requests', existing.requestId);
      const latest = await tx.opsSupplierContractVersion.findFirst({ where: { requestId: existing.requestId }, orderBy: { version: 'desc' } });
      if (!latest || latest.id !== existing.id) throw new BadRequestException('A newer contract version has replaced this one');
      if (latest.reviewStatus !== 'submitted') throw new BadRequestException('Only a submitted contract can be reviewed');
      const updated = await tx.opsSupplierContractVersion.updateMany({
        where: { id: versionId, reviewStatus: 'submitted' },
        data: { reviewStatus: input.decision, reviewReason: input.reason.trim() || null, reviewedAt: new Date(), reviewedBy: actor.name },
      });
      if (updated.count !== 1) throw new BadRequestException('Contract review changed before this decision was saved');
      const result = await tx.opsSupplierContractVersion.findUnique({ where: { id: versionId } });
      if (!result) throw new NotFoundException('Supplier contract version not found');
      await writeAudit(this.auditWriter, existing.eventId, actor.name, `Supplier contract ${input.decision}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Documents,
        affectedType: 'supplier_contract_version', affectedId: versionId, affectedLabel: existing.fileName,
        metadata: { decision: input.decision, reason: input.reason },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-contract-review:${versionId}` });
      return this.mapContract(result);
    });
  }

  async acknowledgeSchedule(requestId: string, input: AcknowledgeSupplierScheduleInput, actor: ResolvedEventOpsActor) {
    const { supplier } = await this.supplierRequest(requestId, actor);
    const schedule = await this.prisma.opsSupplierSchedule.findUnique({ where: { requestId } });
    if (!schedule) throw new NotFoundException('Supplier schedule not found');
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, schedule.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, requestId, schedule.eventId, supplier.id);
      await lockRow(tx, 'supplier_schedules', schedule.id);
      const current = await tx.opsSupplierSchedule.findUnique({ where: { requestId } });
      if (!current) throw new NotFoundException('Supplier schedule not found');
      if (current.revision !== input.expectedRevision) throw new BadRequestException('The schedule changed. Review the latest times before responding.');
      if (current.acknowledgedRevision === current.revision) return this.mapSchedule(current);
      const updated = await tx.opsSupplierSchedule.update({ where: { requestId }, data: {
        acknowledgedRevision: current.revision, acknowledgedAt: new Date(), acknowledgedBy: supplier.id,
        changeRequestNote: null, changeRequestedAt: null,
      } });
      await writeAudit(this.auditWriter, current.eventId, actor.name, `Supplier acknowledged schedule: ${supplier.name}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_schedule', affectedId: schedule.id, affectedLabel: supplier.name,
        metadata: { requestId, revision: current.revision, response: 'acknowledged' },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-schedule-ack:${schedule.id}:${current.revision}` });
      return this.mapSchedule(updated);
    });
  }

  async requestScheduleChange(requestId: string, input: RequestSupplierScheduleChangeInput, actor: ResolvedEventOpsActor) {
    const { supplier } = await this.supplierRequest(requestId, actor);
    const schedule = await this.prisma.opsSupplierSchedule.findUnique({ where: { requestId } });
    if (!schedule) throw new NotFoundException('Supplier schedule not found');
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, schedule.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, requestId, schedule.eventId, supplier.id);
      await lockRow(tx, 'supplier_schedules', schedule.id);
      const current = await tx.opsSupplierSchedule.findUnique({ where: { requestId } });
      if (!current) throw new NotFoundException('Supplier schedule not found');
      if (current.revision !== input.expectedRevision) throw new BadRequestException('The schedule changed. Review the latest times before responding.');
      const updated = await tx.opsSupplierSchedule.update({ where: { requestId }, data: {
        acknowledgedRevision: null, acknowledgedAt: null, acknowledgedBy: null,
        changeRequestNote: input.reason.trim(), changeRequestedAt: new Date(),
      } });
      await writeAudit(this.auditWriter, current.eventId, actor.name, `Supplier requested a schedule change: ${supplier.name}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_schedule', affectedId: schedule.id, affectedLabel: supplier.name,
        metadata: { requestId, revision: current.revision, reason: input.reason.trim() },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-schedule-change:${schedule.id}:${current.revision}` });
      return this.mapSchedule(updated);
    });
  }

  async createCreativeTask(eventId: string, input: CreateSupplierCreativeTaskInput, actor: ResolvedEventOpsActor) {
    await this.requirePmcm(actor, 'create supplier creative task', eventId);
    const normalized = {
      requestId: input.requestId,
      title: input.title.trim(),
      brief: input.brief.trim(),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    };
    const taskId = `sct_${createHash('sha256').update(`${eventId}:${input.idempotencyKey}`).digest('hex')}`;
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, eventId, actor, this.eventReferences);
      const request = await this.requireCreativeTaskAssignment(tx, eventId, input.requestId);
      const supplierId = request.supplierId;
      const existing = await tx.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
      if (existing) {
        if (!sameCreativeTaskInput(existing, eventId, supplierId, normalized)) throw new BadRequestException('Idempotency key was reused for another supplier deliverable');
        return this.mapCreativeTask(existing);
      }
      const task = await tx.opsSupplierCreativeTask.create({ data: {
        id: taskId, eventId, requestId: request.id, supplierId,
        title: normalized.title, brief: normalized.brief, dueAt: normalized.dueAt, createdBy: actor.name,
      } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Created supplier deliverable: ${task.title}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Suppliers,
        affectedType: 'supplier_creative_task', affectedId: task.id, affectedLabel: task.title,
        metadata: { requestId: request.id, supplierId: request.supplierId },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-creative-task:${task.id}` });
      return this.mapCreativeTask(task);
    });
  }

  private async requireCreativeTaskAssignment(tx: PrismaTypes.TransactionClient, eventId: string, requestId: string) {
    await lockRow(tx, 'quote_requests', requestId);
    const request = await tx.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request || request.eventId !== eventId || request.status !== 'selected' || request.assignmentStatus !== 'confirmed' || !request.supplierId) {
      throw new BadRequestException('A confirmed assignment in this event is required');
    }
    return { ...request, supplierId: request.supplierId };
  }

  async updateCreativeProgress(taskId: string, input: UpdateSupplierCreativeProgressInput, actor: ResolvedEventOpsActor) {
    const { task, supplier } = await this.supplierTask(taskId, actor);
    if (!['open', 'in_progress', 'changes_requested'].includes(task.status)) throw new BadRequestException('This deliverable is not open for supplier updates');
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, task.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, task.requestId, task.eventId, supplier.id);
      await lockRow(tx, 'supplier_creative_tasks', taskId);
      const current = await tx.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
      if (!current || current.supplierId !== supplier.id || !['open', 'in_progress', 'changes_requested'].includes(current.status)) throw new BadRequestException('This deliverable is not open for supplier updates');
      const status = current.status === 'open' ? 'in_progress' : current.status;
      const updated = await tx.opsSupplierCreativeTask.update({ where: { id: taskId }, data: { status, supplierProgressNote: input.note.trim() } });
      await writeAudit(this.auditWriter, current.eventId, actor.name, `Updated supplier deliverable progress: ${current.title}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_creative_task', affectedId: taskId, affectedLabel: current.title,
        metadata: { status, progressNote: input.note.trim() },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-creative-progress:${taskId}:${randomUUID()}` });
      return this.mapCreativeTask(updated);
    });
  }

  async submitCreativeTask(taskId: string, input: SubmitSupplierCreativeTaskInput, actor: ResolvedEventOpsActor) {
    const { task } = await this.supplierTask(taskId, actor);
    let object: Awaited<ReturnType<StoredSupplierUploadReader['findConfirmedSupplierUpload']>> = null;
    if (input.storedObjectId) {
      object = await this.storedSupplierUploads.findConfirmedSupplierUpload({
        objectId: input.storedObjectId, eventId: task.eventId, supplierId: task.supplierId,
        logicalTargetPrefix: creativeTargetPrefix(task.requestId),
      });
      if (!object) {
        throw new BadRequestException('The attachment is not a confirmed upload for this assignment');
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, task.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, task.requestId, task.eventId, task.supplierId);
      await lockRow(tx, 'supplier_creative_tasks', taskId);
      const current = await tx.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
      if (!current) throw new NotFoundException('Supplier deliverable not found');
      if (current.status === 'submitted') {
        const priorSubmission = await tx.opsSupplierCreativeSubmission.findFirst({
          where: { taskId, version: current.submissionVersion },
        });
        if (priorSubmission && priorSubmission.storedObjectId === (object?.id ?? null) &&
          priorSubmission.note === input.note.trim() && priorSubmission.submittedBy === actor.name) {
          return this.mapCreativeTask({ ...current, submissions: [priorSubmission] });
        }
        throw new BadRequestException('This deliverable is already submitted');
      }
      if (!['open', 'in_progress', 'changes_requested'].includes(current.status)) throw new BadRequestException('This deliverable is not open for submission');
      const version = current.submissionVersion + 1;
      const submission = await tx.opsSupplierCreativeSubmission.create({ data: {
        id: `scs_${randomUUID()}`, taskId, version, storedObjectId: object?.id ?? null,
        note: input.note.trim(), submittedBy: actor.name,
      } });
      const updated = await tx.opsSupplierCreativeTask.update({ where: { id: taskId }, data: {
        status: 'submitted', submissionObjectId: object?.id ?? null, submissionNote: input.note.trim(),
        submissionVersion: version, submittedAt: new Date(),
      } });
      await writeAudit(this.auditWriter, task.eventId, actor.name, `Submitted supplier deliverable: ${task.title}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Upload, category: AuditCategory.Documents,
        affectedType: 'supplier_creative_submission', affectedId: submission.id, affectedLabel: task.title,
        metadata: { taskId, version, storedObjectId: object?.id ?? null },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-creative-submission:${taskId}:${version}` });
      return this.mapCreativeTask({ ...updated, submissions: [submission] });
    });
  }

  async reviewCreativeTask(taskId: string, input: UpdateSupplierCreativeTaskInput, actor: ResolvedEventOpsActor) {
    if (!['accepted', 'changes_requested', 'cancelled'].includes(input.status)) {
      throw new BadRequestException('Unsupported supplier deliverable review status');
    }
    const task = await this.prisma.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Supplier deliverable not found');
    await this.requirePmcm(actor, 'review supplier creative task', task.eventId);
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, task.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, task.requestId, task.eventId, task.supplierId);
      await lockRow(tx, 'supplier_creative_tasks', taskId);
      const current = await tx.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
      if (!current) throw new NotFoundException('Supplier deliverable not found');
      if (input.status !== 'cancelled' && current.status !== 'submitted') throw new BadRequestException('Only submitted deliverables can be accepted or returned');
      if (input.status === 'cancelled' && ['accepted', 'cancelled'].includes(current.status)) throw new BadRequestException('This deliverable can no longer be cancelled');
      const result = await tx.opsSupplierCreativeTask.updateMany({
        where: { id: taskId, status: current.status },
        data: { status: input.status, reviewedAt: new Date(), reviewedBy: actor.name, reviewNote: input.reviewNote?.trim() ?? null },
      });
      if (result.count !== 1) throw new BadRequestException('Deliverable status changed before review was saved');
      await writeAudit(this.auditWriter, current.eventId, actor.name, `Supplier deliverable ${input.status}: ${current.title}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_creative_task', affectedId: taskId, affectedLabel: current.title,
        metadata: { status: input.status, reviewNote: input.reviewNote ?? '' },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-creative-review:${taskId}:${current.submissionVersion}` });
      const reviewed = await tx.opsSupplierCreativeTask.findUnique({ where: { id: taskId }, include: { submissions: { orderBy: { version: 'desc' } } } });
      if (!reviewed) throw new NotFoundException('Supplier deliverable not found');
      return this.mapCreativeTask(reviewed);
    });
  }

  async createPayable(eventId: string, input: CreateSupplierPayableMilestoneInput, actor: ResolvedEventOpsActor) {
    await this.requirePmcm(actor, 'create supplier payable milestone', eventId);
    const quote = await this.prisma.opsSupplierQuote.findUnique({ where: { id: input.quoteId } });
    if (!quote || quote.eventId !== eventId || quote.requestId !== input.requestId || quote.status !== 'selected' || !quote.lockedAt || !quote.supplierId || !quote.requestId) {
      throw new BadRequestException('A locked quote for the selected supplier assignment is required');
    }
    const requestId = quote.requestId;
    const supplierId = quote.supplierId;
    const hash = payloadHash({ ...input, eventId, supplierId });
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, requestId, eventId, supplierId);
      await lockRow(tx, 'quotes', quote.id);
      const currentQuote = await this.requireSelectedLockedQuote(tx, quote.id, eventId, requestId, supplierId);
      const replay = await tx.opsSupplierPayableMilestone.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) return this.replayPayable(tx, replay, hash);
      const existing = await tx.opsSupplierPayableMilestone.aggregate({ where: { quoteId: quote.id, status: { not: 'cancelled' } }, _sum: { amount: true } });
      if ((existing._sum.amount ?? 0) + input.amount > currentQuote.amount) throw new BadRequestException('Supplier payable milestones cannot exceed the locked quote amount');
      const created = await tx.opsSupplierPayableMilestone.create({ data: {
        id: `spm_${randomUUID()}`, eventId, requestId, quoteId: quote.id, supplierId,
        label: input.label, amount: input.amount, dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash: hash,
      } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Created supplier payable: ${created.label}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Finance,
        affectedType: 'supplier_payable_milestone', affectedId: created.id, affectedLabel: created.label,
        metadata: { requestId: input.requestId, quoteId: quote.id, amount: input.amount },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-payable:${input.idempotencyKey}` });
      return this.payableById(tx, created.id);
    });
  }

  private async requireSelectedLockedQuote(tx: PrismaTypes.TransactionClient, quoteId: string, eventId: string, requestId: string, supplierId: string) {
    const quote = await tx.opsSupplierQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.eventId !== eventId || quote.requestId !== requestId || quote.supplierId !== supplierId || quote.status !== 'selected' || !quote.lockedAt) {
      throw new BadRequestException('A locked quote for the selected supplier assignment is required');
    }
    return quote;
  }

  private replayPayable(tx: PrismaTypes.TransactionClient, milestone: { id: string; payloadHash: string | null }, hash: string) {
    if (milestone.payloadHash !== hash) throw new BadRequestException('Idempotency key was reused for a different milestone');
    return this.payableById(tx, milestone.id);
  }

  async releasePayout(milestoneId: string, input: ReleaseSupplierPayoutInput, actor: ResolvedEventOpsActor) {
    const before = await this.prisma.opsSupplierPayableMilestone.findUnique({ where: { id: milestoneId } });
    if (!before) throw new NotFoundException('Supplier payable milestone not found');
    await this.requirePmcm(actor, 'release supplier payment', before.eventId);
    const hash = payloadHash({ milestoneId, ...input });
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, before.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, before.requestId, before.eventId, before.supplierId);
      await lockRow(tx, 'supplier_payable_milestones', milestoneId);
      const milestone = await tx.opsSupplierPayableMilestone.findUnique({ where: { id: milestoneId } });
      if (!milestone || milestone.status === 'cancelled') throw new NotFoundException('Supplier payable milestone not found');
      const replay = await tx.opsSupplierPayoutRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.payloadHash !== hash) throw new BadRequestException('Idempotency key was reused for a different payout');
        return this.payableById(tx, milestoneId);
      }
      const history = await tx.opsSupplierPayoutRecord.findMany({ where: { milestoneId } });
      const released = netReleased(history);
      if (released + input.amount > milestone.amount) throw new BadRequestException('Payout exceeds the remaining milestone balance');
      await tx.opsSupplierPayoutRecord.create({ data: {
        id: `spr_${randomUUID()}`, eventId: milestone.eventId, milestoneId, requestId: milestone.requestId,
        quoteId: milestone.quoteId, supplierId: milestone.supplierId, kind: 'release', amount: input.amount,
        paymentDate: new Date(input.paymentDate), method: input.method, referenceNumber: input.referenceNumber,
        notes: input.notes?.trim() ?? null, idempotencyKey: input.idempotencyKey, payloadHash: hash, recordedBy: actor.name,
      } });
      await tx.opsSupplierPayableMilestone.update({ where: { id: milestoneId }, data: { status: released + input.amount === milestone.amount ? 'released' : 'partially_released' } });
      await writeAudit(this.auditWriter, milestone.eventId, actor.name, `Released supplier payment: ${milestone.label}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Finance,
        affectedType: 'supplier_payout_record', affectedId: input.idempotencyKey, affectedLabel: milestone.label,
        metadata: { milestoneId, amount: input.amount, method: input.method, referenceNumber: input.referenceNumber },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-payout:${input.idempotencyKey}` });
      return this.payableById(tx, milestoneId);
    });
  }

  async reversePayout(recordId: string, input: ReverseSupplierPayoutInput, actor: ResolvedEventOpsActor) {
    const before = await this.prisma.opsSupplierPayoutRecord.findUnique({ where: { id: recordId } });
    if (!before || before.kind !== 'release') throw new NotFoundException('Supplier payout release not found');
    await this.requirePmcm(actor, 'reverse supplier payment', before.eventId);
    const hash = payloadHash({ recordId, ...input });
    return this.prisma.$transaction(async (tx) => {
      await lockActiveEvent(tx, before.eventId, actor, this.eventReferences);
      await lockConfirmedSupplierAssignment(tx, before.requestId, before.eventId, before.supplierId);
      await lockRow(tx, 'supplier_payable_milestones', before.milestoneId);
      const replay = await tx.opsSupplierPayoutRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.payloadHash !== hash) throw new BadRequestException('Idempotency key was reused for a different reversal');
        return this.payableById(tx, before.milestoneId);
      }
      const existing = await tx.opsSupplierPayoutRecord.findFirst({ where: { reversesRecordId: recordId } });
      if (existing) return this.payableById(tx, before.milestoneId);
      const created = await tx.opsSupplierPayoutRecord.create({ data: {
        id: `spr_${randomUUID()}`, eventId: before.eventId, milestoneId: before.milestoneId, requestId: before.requestId,
        quoteId: before.quoteId, supplierId: before.supplierId, kind: 'reversal', amount: before.amount,
        paymentDate: new Date(input.paymentDate), method: before.method, referenceNumber: before.referenceNumber,
        notes: input.reason.trim(), reversesRecordId: before.id, idempotencyKey: input.idempotencyKey, payloadHash: hash, recordedBy: actor.name,
      } });
      const milestone = await tx.opsSupplierPayableMilestone.findUnique({ where: { id: before.milestoneId } });
      if (milestone) {
        const history = await tx.opsSupplierPayoutRecord.findMany({ where: { milestoneId: milestone.id } });
        const released = netReleased(history);
        await tx.opsSupplierPayableMilestone.update({ where: { id: milestone.id }, data: {
          status: released <= 0 ? 'scheduled' : released >= milestone.amount ? 'released' : 'partially_released',
        } });
      }
      await writeAudit(this.auditWriter, before.eventId, actor.name, `Reversed supplier payment: ${before.referenceNumber || before.id}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Finance,
        affectedType: 'supplier_payout_record', affectedId: created.id, affectedLabel: before.referenceNumber || before.id,
        metadata: { reversesRecordId: before.id, amount: before.amount, reason: input.reason },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-payout-reversal:${input.idempotencyKey}` });
      return this.payableById(tx, before.milestoneId);
    });
  }

  async pmcmWorkspace(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismPmcmSupplierWorkflowWorkspace[]> {
    await this.requirePmcm(actor, 'read supplier workflows', eventId);
    const requests = await this.prisma.opsSupplierQuoteRequest.findMany({
      where: { eventId, status: 'selected' }, orderBy: [{ supplierName: 'asc' }, { id: 'asc' }], take: 250,
      include: {
        schedule: true,
        contractVersions: { orderBy: [{ version: 'desc' }, { id: 'desc' }] },
        creativeTasks: { include: { submissions: { orderBy: [{ version: 'desc' }, { id: 'desc' }] } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }] },
        payableMilestones: { include: { payouts: { orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] } }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] },
      },
    });
    return requests.map((request) => ({
      requestId: request.id, eventId, supplierId: request.supplierId ?? '', supplierName: request.supplierName,
      assignmentStatus: request.assignmentStatus,
      schedule: request.schedule ? this.mapSchedule(request.schedule) : null,
      contracts: request.contractVersions.map((contract) => this.mapContract(contract)),
      creativeTasks: request.creativeTasks.map((task) => this.mapCreativeTask(task)),
      payables: request.payableMilestones.map((milestone) => this.mapPayable(milestone)),
    }));
  }

  private mapSchedule(schedule: {
    id: string; eventId: string; requestId: string; ingressAt: Date; egressAt: Date; location: string; notes: string;
    status: string; revision: number; acknowledgedRevision: number | null; acknowledgedAt: Date | null;
    changeRequestedAt: Date | null; changeRequestNote: string | null;
  }): PrismSupplierWorkflowSchedule {
    return {
      id: schedule.id, eventId: schedule.eventId, requestId: schedule.requestId,
      ingressAt: schedule.ingressAt.toISOString(), egressAt: schedule.egressAt.toISOString(),
      location: schedule.location, notes: schedule.notes, status: schedule.status, revision: schedule.revision,
      acknowledgedRevision: schedule.acknowledgedRevision, acknowledgedAt: schedule.acknowledgedAt?.toISOString() ?? null,
      changeRequestedAt: schedule.changeRequestedAt?.toISOString() ?? null, changeRequestNote: schedule.changeRequestNote,
    };
  }

  private mapContract(contract: {
    id: string; eventId: string; requestId: string; supplierId: string; version: number; storedObjectId: string;
    fileName: string; mimeType: string; sizeBytes: number; checksumSha256: string; reviewStatus: string;
    reviewReason: string | null; uploadedAt: Date; reviewedAt: Date | null; reviewedBy: string | null;
  }): PrismSupplierContractVersion {
    return {
      id: contract.id, eventId: contract.eventId, requestId: contract.requestId, supplierId: contract.supplierId,
      version: contract.version, storedObjectId: contract.storedObjectId, fileName: contract.fileName,
      mimeType: contract.mimeType, sizeBytes: contract.sizeBytes, checksumSha256: contract.checksumSha256,
      reviewStatus: contractReviewStatus(contract.reviewStatus), reviewReason: contract.reviewReason,
      uploadedAt: contract.uploadedAt.toISOString(), reviewedAt: contract.reviewedAt?.toISOString() ?? null,
      reviewedBy: contract.reviewedBy,
    };
  }

  private mapCreativeTask(task: {
    id: string; eventId: string; requestId: string; supplierId: string; title: string; brief: string;
    dueAt: Date | null; status: string; supplierProgressNote: string; submissionVersion: number; submittedAt: Date | null;
    reviewedAt: Date | null; reviewedBy: string | null; reviewNote: string | null; createdAt: Date; updatedAt: Date;
    submissions?: Array<{ id: string; taskId: string; version: number; storedObjectId: string | null; note: string; submittedBy: string; submittedAt: Date }>;
  }): PrismSupplierCreativeTask {
    return {
      id: task.id, eventId: task.eventId, requestId: task.requestId, supplierId: task.supplierId,
      title: task.title, brief: task.brief, dueAt: task.dueAt?.toISOString() ?? null,
      status: creativeStatus(task.status), supplierProgressNote: task.supplierProgressNote, submissionVersion: task.submissionVersion,
      submittedAt: task.submittedAt?.toISOString() ?? null, reviewedAt: task.reviewedAt?.toISOString() ?? null,
      reviewedBy: task.reviewedBy, reviewNote: task.reviewNote,
      submissions: (task.submissions ?? []).map((submission) => ({
        id: submission.id, taskId: submission.taskId, version: submission.version,
        storedObjectId: submission.storedObjectId, note: submission.note,
        submittedBy: submission.submittedBy, submittedAt: submission.submittedAt.toISOString(),
      })),
      createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
    };
  }

  private async payableById(tx: PrismaTypes.TransactionClient, milestoneId: string) {
    const milestone = await tx.opsSupplierPayableMilestone.findUnique({ where: { id: milestoneId }, include: { payouts: { orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] } } });
    if (!milestone) throw new NotFoundException('Supplier payable milestone not found');
    return this.mapPayable(milestone);
  }

  private mapPayable(milestone: {
    id: string; eventId: string; requestId: string; quoteId: string; label: string; amount: number; dueDate: Date | null;
    status: string; createdAt: Date; payouts: Array<{ id: string; milestoneId: string; kind: string; amount: number; paymentDate: Date; method: string; referenceNumber: string; notes: string | null; reversesRecordId: string | null; recordedAt: Date }>;
  }): PrismSupplierPayableMilestone {
    const amountReleased = netReleased(milestone.payouts);
    return {
      id: milestone.id, eventId: milestone.eventId, requestId: milestone.requestId, quoteId: milestone.quoteId,
      label: milestone.label, amount: milestone.amount, dueDate: milestone.dueDate?.toISOString() ?? null,
      status: payableStatus(milestone.status), amountReleased, remainingBalance: milestone.amount - amountReleased,
      history: milestone.payouts.map((record) => ({
        id: record.id, milestoneId: record.milestoneId,
        kind: record.kind === 'release' ? 'release' as const : 'reversal' as const,
        amount: record.amount, paymentDate: record.paymentDate.toISOString(), method: record.method,
        referenceNumber: record.referenceNumber, notes: record.notes, reversesRecordId: record.reversesRecordId,
        recordedAt: record.recordedAt.toISOString(),
      })),
      createdAt: milestone.createdAt.toISOString(),
    };
  }

  private async supplierRequest(requestId: string, actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier workflow');
    const supplier = await this.resolveSupplier(actor);
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Supplier assignment not found');
    if (request.supplierId !== supplier.id) {
      await this.policy.recordForbiddenAccess(actor, 'supplier workflow', request.id);
      throw new ForbiddenException('Supplier cannot access this assignment');
    }
    return { supplier, request };
  }

  private async supplierTask(taskId: string, actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier deliverable');
    const supplier = await this.resolveSupplier(actor);
    const task = await this.prisma.opsSupplierCreativeTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Supplier deliverable not found');
    if (task.supplierId !== supplier.id) {
      await this.policy.recordForbiddenAccess(actor, 'supplier deliverable', task.id);
      throw new ForbiddenException('Supplier cannot access this deliverable');
    }
    if (task.requestId) await this.supplierRequest(task.requestId, actor);
    return { supplier, task };
  }

  private async activeEventIds(eventIds: string[]) {
    const ids = [...new Set(eventIds)];
    if (ids.length === 0) return new Set<string>();
    const events = await this.eventReferences.findOperationsEvents(ids);
    return new Set(events.filter((event) => !event.archived).map((event) => event.id));
  }

  private async resolveSupplier(actor: ResolvedEventOpsActor) {
    const supplier = actor.supplierId
      ? await this.prisma.opsSupplier.findUnique({ where: { id: actor.supplierId } })
      : actor.email
        ? await this.prisma.opsSupplier.findFirst({ where: { email: { equals: actor.email, mode: 'insensitive' } } })
        : null;
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private requirePmcm(actor: ResolvedEventOpsActor, resource: string, eventId: string) {
    return this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
  }
}
