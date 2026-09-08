import { Inject, Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import type { OpsBillingStatement, OpsBillingSource, OpsPaymentMilestone, OpsPaymentRecord, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, StorageObjectService, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { nextPaymentMilestoneStatus, validatePaymentTerms } from '../../domain/payment-terms.policy';
import type {
  ApproveBillingSourceInput,
  BillingActor,
  BillingLineItemInput,
  BillingMethodInput,
  BillingScheduleInput,
  CreateBillingSourceInput,
  RecordPaymentInput,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  CreateBillingDisputeInput,
  ResolveBillingDisputeInput,
  CreateAdditionalBillingInput,
  WaiveAdditionalBillingInput,
} from '../../contracts/finance-commands.port';

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
  return date;
}

function auditMetadata(actor: BillingActor, metadata: Record<string, unknown> = {}) {
  const next = { ...metadata };
  if (actor.correlationId) next.correlationId = actor.correlationId;
  return Object.keys(next).length > 0 ? next : undefined;
}

function renderBillingPdf(input: { number: string; sourceLabel: string; totalAmount: number }) {
  const text = `P.R.I.S.M BILLING STATEMENT\\n${input.number}\\nSource: ${input.sourceLabel}\\nTotal: ${input.totalAmount}`;
  const body = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${body.length} >>\\nstream\\n${body}\\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${index + 1} 0 obj\\n${object}\\nendobj\\n`; });
  const start = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \\n`; });
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${start}\\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function paymentReplay(milestone: OpsPaymentMilestone, history: OpsPaymentRecord[]) {
  const amountPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
  const remainingBalance = Math.max(0, milestone.amount - amountPaid);
  return {
    payment: {
      ...milestone,
      amountPaid,
      remainingBalance,
      status: remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
    },
    history,
  };
}

function isDuplicatePayment(record: OpsPaymentRecord, input: RecordPaymentInput, paymentDate: Date) {
  return record.referenceNumber === (input.referenceNumber?.trim() ?? '')
    && record.amountReceived === input.amountReceived
    && isoDate(record.paymentDate) === isoDate(paymentDate)
    && record.paymentMethod === input.paymentMethod;
}

function assertPaymentWithinBalance(milestone: OpsPaymentMilestone, history: OpsPaymentRecord[], input: RecordPaymentInput) {
  const currentPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
  if (currentPaid + input.amountReceived > milestone.amount) {
    throw new BadRequestException('Payment record exceeds remaining milestone balance');
  }
}

function assertPositivePayment(amount: number) {
  if (amount <= 0) throw new BadRequestException('Amount received must be greater than zero');
}

@Injectable()
export class BillingOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Optional() private readonly storageObjectService?: StorageObjectService,
  ) {}

  async runPaymentRiskSweep() {
    const now = new Date();
    const threshold = addDays(now, 2);
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        eventDate: {
          gte: now,
          lte: threshold,
        },
      },
      select: { id: true, eventName: true },
    });

    const eventIds = events.map((event) => event.id);
    const milestones = eventIds.length === 0
      ? []
      : await this.prisma.opsPaymentMilestone.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: [{ eventId: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
        });
    const milestonesByEventId = new Map<string, OpsPaymentMilestone[]>();
    for (const milestone of milestones) {
      const eventMilestones = milestonesByEventId.get(milestone.eventId) ?? [];
      eventMilestones.push(milestone);
      milestonesByEventId.set(milestone.eventId, eventMilestones);
    }

    for (const event of events) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: two-day payment risk window.
      const balance = (milestonesByEventId.get(event.id) ?? []).find((milestone) =>
        milestone.label.toLowerCase().includes('balance'),
      );
      if (!balance || balance.status === 'paid' || balance.remainingBalance <= 0 || balance.status === 'at_risk') {
        continue;
      }

      await this.workflowCommandService.execute<OpsPaymentMilestone>({
        name: 'mark_payment_at_risk',
        eventId: event.id,
        write: () =>
          this.prisma.opsPaymentMilestone.update({
            where: { id: balance.id },
            data: { status: 'at_risk' },
          }),
        sideEffects: async (payment) => {
          await writeAudit(this.auditWriter, event.id, 'System', `Payment at risk for ${event.eventName}`, {
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'payment_milestone',
            affectedId: payment.id,
            affectedLabel: payment.label,
            severity: 'warning',
          });
        },
      });
    }
  }

  async markPayment(eventId: string, milestoneId: string, status: string, actor: BillingActor = { name: 'PMCM Admin' }) {
    let milestone: OpsPaymentMilestone | null = null;
    return this.workflowCommandService.execute<OpsPaymentMilestone, ReturnType<BillingOperationsService['mapPaymentMilestone']>>({
      name: 'mark_payment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
        if (!milestone || milestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
        status = nextPaymentMilestoneStatus({ current: milestone.status, amountPaid: milestone.amountPaid, amount: milestone.amount, requested: status });
      },
      write: () =>
        this.prisma.opsPaymentMilestone
          .update({
            where: { id: milestoneId },
            data: { status },
          })
          .catch(() => {
            throw new NotFoundException('Payment milestone not found');
          }),
      sideEffects: async (payment) => {
        await Promise.all([
          writeAudit(this.auditWriter, eventId, actor.name, `Marked ${payment.label} as ${status}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'payment_milestone',
            affectedId: payment.id,
            affectedLabel: payment.label,
            metadata: auditMetadata(actor),
          }),
          writeNotification(this.notificationOutboxWriter, eventId, 'Finance', `${payment.label} ${status}`),
        ]);
      },
      project: (payment) => this.mapPaymentMilestone(payment),
    });
  }

  async recordPayment(
    eventId: string,
    milestoneId: string,
    input: RecordPaymentInput,
    actor: BillingActor = { name: 'PMCM Admin' },
  ) {
    let milestone: OpsPaymentMilestone | null = null;
    let paymentDate: Date | null = null;
    let paymentPayloadHash = '';
    let duplicateReplay: { payment: OpsPaymentMilestone; history: OpsPaymentRecord[] } | null = null;

    return this.workflowCommandService.execute<
      { payment: OpsPaymentMilestone; history: OpsPaymentRecord[] },
      ReturnType<BillingOperationsService['mapPaymentMilestone']>
    >({
      name: 'record_payment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);

        milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
        if (!milestone || milestone.eventId !== eventId) {
          throw new NotFoundException('Payment milestone not found');
        }

        assertPositivePayment(input.amountReceived);

        const existingHistory = (await this.prisma.opsPaymentRecord.findMany({
          where: { milestoneId },
          orderBy: { paymentDate: 'asc' },
        })) as OpsPaymentRecord[];
        paymentDate = parseDate(input.paymentDate);
        paymentPayloadHash = createHash('sha256').update(JSON.stringify({ eventId, milestoneId, ...input })).digest('hex');
        const keyedRecord = input.idempotencyKey && this.prisma.opsPaymentRecord.findUnique
          ? await this.prisma.opsPaymentRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
          : null;
        if (keyedRecord) {
          if (keyedRecord.payloadHash && keyedRecord.payloadHash !== paymentPayloadHash) {
            throw new BadRequestException('Payment idempotency key was reused for different content');
          }
          duplicateReplay = paymentReplay(milestone, existingHistory);
          return;
        }
        const duplicateRecord = input.referenceNumber?.trim()
          ? existingHistory.find((record) => isDuplicatePayment(record, input, paymentDate!))
          : undefined;
        if (duplicateRecord) {
          duplicateReplay = paymentReplay(milestone, existingHistory);
          return;
        }
        assertPaymentWithinBalance(milestone, existingHistory, input);
      },
      write: async () => {
        if (!milestone) throw new NotFoundException('Payment milestone not found');
        if (duplicateReplay) return duplicateReplay;
        const recordedPaymentDate = paymentDate ?? parseDate(input.paymentDate);
        paymentDate = recordedPaymentDate;

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          await tx.opsPaymentRecord.create({
            data: {
              id: `payrec_${randomUUID()}`,
              eventId,
              milestoneId,
              amountReceived: input.amountReceived,
              paymentDate: recordedPaymentDate,
              paymentMethod: input.paymentMethod,
              referenceNumber: input.referenceNumber ?? '',
              idempotencyKey: input.idempotencyKey ?? null,
              payloadHash: paymentPayloadHash,
            },
          });

          const history = await tx.opsPaymentRecord.findMany({
            where: { milestoneId },
            orderBy: { paymentDate: 'asc' },
          });
          const amountPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
          const remainingBalance = Math.max(0, milestone!.amount - amountPaid);
          const nextStatus = remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';
          const payment = await tx.opsPaymentMilestone.update({
            where: { id: milestoneId },
            data: { amountPaid, remainingBalance, status: nextStatus },
          });

          return { payment, history };
        });
      },
      sideEffects: async ({ payment }) => {
        if (duplicateReplay) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Recorded ${input.paymentMethod} payment for ${payment.label}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'payment_milestone',
          affectedId: milestoneId,
          affectedLabel: payment.label,
          metadata: auditMetadata(actor, {
            amountReceived: input.amountReceived,
            referenceNumber: input.referenceNumber ?? '',
          }),
        });
      },
      project: ({ payment, history }) => this.mapPaymentMilestone(payment, history),
    });
  }

  async createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor) {
    let lineItems: BillingLineItemInput[] = [];
    let totalAmount = 0;
    let paymentSchedule: ReturnType<BillingOperationsService['normalizeBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['normalizeBillingMethods']> = [];
    let paymentTermsPolicyState = 'standard';
    let paymentTermsOverrideReason: string | null = null;
    let replayed = false;
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    return this.workflowCommandService.execute<OpsBillingSource, ReturnType<BillingOperationsService['mapBillingSource']>>({
      name: 'create_billing_source',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        lineItems = this.normalizeBillingLineItems(input.lineItems);
        totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        if (totalAmount <= 0) throw new BadRequestException('Billing source total must be greater than zero');
        paymentSchedule = this.normalizeBillingSchedule(input.paymentSchedule, totalAmount);
        const terms = validatePaymentTerms({ schedule: paymentSchedule, policy: input.paymentTermsPolicy, overrideReason: input.paymentTermsOverrideReason });
        paymentTermsPolicyState = terms.state;
        paymentTermsOverrideReason = terms.overrideReason;
        paymentMethods = this.normalizeBillingMethods(input.paymentMethods);
      },
      write: () =>
        (async () => {
          if (input.idempotencyKey && this.prisma.opsBillingSource.findUnique) {
            const replay = await this.prisma.opsBillingSource.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
            if (replay) {
              if (replay.payloadHash && replay.payloadHash !== payloadHash) throw new BadRequestException('Billing source idempotency key was reused for different content');
              replayed = true;
              return replay;
            }
          }
          return this.prisma.opsBillingSource.create({
            data: {
              id: `bsrc_${randomUUID()}`,
              eventId,
              sourceType: input.sourceType?.trim() || 'ce_proposal',
              sourceLabel: input.sourceLabel.trim(),
              sourceDocumentId: input.sourceDocumentId ?? null,
              lineItems: toPrismaJson(lineItems),
              paymentSchedule: toPrismaJson(paymentSchedule),
              paymentMethods: toPrismaJson(paymentMethods),
              totalAmount,
              status: 'draft',
              paymentTermsPolicyState,
              paymentTermsOverrideReason,
              payloadHash,
              idempotencyKey: input.idempotencyKey ?? null,
            },
          });
        })(),
      sideEffects: async (source) => {
        if (replayed) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Created billing source: ${source.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: source.id,
          affectedLabel: source.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount }),
        });
      },
      project: (source) => this.mapBillingSource(source),
    });
  }

  async approveBillingSource(
    eventId: string,
    sourceId: string,
    input: ApproveBillingSourceInput = {},
    actor: BillingActor,
  ) {
    const approvedBy = actor.name;
    let source: OpsBillingSource | null = null;

    return this.workflowCommandService.execute<OpsBillingSource, ReturnType<BillingOperationsService['mapBillingSource']>>({
      name: 'approve_billing_source',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        source = await this.prisma.opsBillingSource.findUnique({ where: { id: sourceId } });
        if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
      },
      write: () =>
        this.prisma.opsBillingSource.update({
          where: { id: sourceId },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy,
            paymentTermsApprovedBy: source?.paymentTermsPolicyState === 'repeat_client_override' ? approvedBy : null,
            approvalNotes: input.approvalNotes?.trim() ?? '',
          },
        }),
      sideEffects: async (approvedSource) => {
        await writeAudit(this.auditWriter, eventId, approvedBy, `Approved billing source: ${approvedSource.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Approve,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: approvedSource.id,
          affectedLabel: approvedSource.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount: approvedSource.totalAmount, approvalNotes: input.approvalNotes ?? '' }),
        });
      },
      project: (approvedSource) => this.mapBillingSource(approvedSource),
    });
  }

  async generateBillingStatement(eventId: string, sourceId?: string, actor: BillingActor = { name: 'PMCM Admin' }, idempotencyKey?: string) {
    let event: Awaited<ReturnType<BillingOperationsService['requireEvent']>> | null = null;
    let inquiry: Awaited<ReturnType<PrismaService['opsInquiry']['findUnique']>> | null = null;
    let source: OpsBillingSource | null = null;
    let billingNumber = '';
    let lineItems: ReturnType<BillingOperationsService['asBillingLineItems']> = [];
    let paymentSchedule: ReturnType<BillingOperationsService['asBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['asBillingMethods']> = [];
    let pdfBytes: Uint8Array = new Uint8Array();
    let storageState = 'pending';
    let storageObjectId: string | null = null;
    let storageKey = '';
    let existingStatement: OpsBillingStatement | null = null;
    const statementId = `bill_${randomUUID()}`;
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, sourceId: sourceId ?? null })).digest('hex');

    return this.workflowCommandService.execute<OpsBillingStatement, ReturnType<BillingOperationsService['mapBillingStatement']>>({
      name: 'generate_billing_statement',
      eventId,
      validateState: async () => {
        event = await this.requireEvent(eventId);
        inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
        source = sourceId
          ? await this.prisma.opsBillingSource.findUnique({ where: { id: sourceId } })
          : await this.prisma.opsBillingSource.findFirst({ where: { eventId, status: 'approved' } });

        if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
        if (source.status !== 'approved') {
          throw new BadRequestException('Billing source must be approved before generating a billing statement');
        }

        if (idempotencyKey && this.prisma.opsBillingStatement.findUnique) {
          existingStatement = await this.prisma.opsBillingStatement.findUnique({ where: { idempotencyKey } });
          if (existingStatement) {
            if (existingStatement.payloadHash && existingStatement.payloadHash !== payloadHash) throw new BadRequestException('Billing statement idempotency key was reused for different content');
            return;
          }
        }

        const billingYear = event.eventDate.getFullYear();
        const billingCount = await this.prisma.opsBillingStatement.count();
        billingNumber = `BS-${billingYear}-${String(billingCount + 1).padStart(4, '0')}`;
        lineItems = this.asBillingLineItems(source.lineItems);
        paymentSchedule = this.asBillingSchedule(source.paymentSchedule, source.totalAmount, event.eventDate);
        paymentMethods = this.asBillingMethods(source.paymentMethods);
        pdfBytes = renderBillingPdf({ number: billingNumber, sourceLabel: source.sourceLabel, totalAmount: source.totalAmount });
        const storage = await this.prepareBillingStatementStorage(eventId, statementId, billingNumber, source, pdfBytes, actor);
        storageState = storage.storageState;
        storageObjectId = storage.storageObjectId;
        storageKey = storage.storageKey;
      },
      write: async () => {
        if (existingStatement) return existingStatement;
        if (!event || !source) throw new NotFoundException('Billing source not found');

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const billingDocument = await tx.opsDocument.create({
            data: {
              id: `doc_${randomUUID()}`,
              eventId: event!.id,
              type: 'billing_statement',
              fileName: `${billingNumber}.pdf`,
              status: storageState === 'stored' ? 'stored' : 'pending_storage',
              mimeType: 'application/pdf',
              storageBucket: 'document-vault',
              storageKey: storageKey || null,
              sizeBytes: pdfBytes.byteLength || null,
              uploadedByRole: 'system',
            },
          });

          const statement = await tx.opsBillingStatement.create({
            data: {
              id: statementId,
              eventId,
              sourceId: source!.id,
              number: billingNumber,
              clientName: inquiry?.clientName ?? event!.clientName,
              clientContact: inquiry?.email ?? '',
              eventName: event!.eventName,
              eventDate: event!.eventDate,
              lineItems: toPrismaJson(lineItems),
              paymentSchedule: toPrismaJson(paymentSchedule),
              paymentMethods: toPrismaJson(paymentMethods),
              totalAmount: source!.totalAmount,
              documentId: billingDocument.id,
              pdfUrl: '',
              storageKey,
              storageObjectId,
              storageState,
              idempotencyKey: idempotencyKey ?? null,
              payloadHash,
              status: 'issued',
            },
          });

          await tx.opsPaymentMilestone.createMany({
            data: paymentSchedule.map((item) => ({
              id: `pay_${randomUUID()}`,
              eventId,
              label: item.label,
              percentage: item.percentage,
              amount: item.amount,
              amountPaid: 0,
              remainingBalance: item.amount,
              dueDate: parseDate(item.dueDate ?? isoDate(addDays(event!.eventDate, -7))),
              status: 'pending',
            })),
          });

          return statement;
        });
      },
      sideEffects: async (statement, context) => {
        if (existingStatement) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Generated billing statement ${billingNumber}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'billing_statement',
          affectedId: statement.id,
          affectedLabel: billingNumber,
          metadata: auditMetadata(actor, { sourceId: source?.id, sourceLabel: source?.sourceLabel, totalAmount: source?.totalAmount }),
        }, context);
        const recipient = inquiry?.email || inquiry?.clientName || event?.clientName || 'Client';
        await Promise.all(paymentSchedule.map((item, index) => writeNotification(
          this.notificationOutboxWriter,
          eventId,
          recipient,
          `${item.label} payment milestone for billing statement ${billingNumber} is due ${item.dueDate ?? 'on the agreed date'}`,
          'email',
          { idempotencyKey: `billing-reminder:${statement.id}:${index}` },
          context,
        )));
      },
      project: (statement) => this.mapBillingStatement(statement),
    });
  }

  async sendBillingStatement(eventId: string, billingId: string, actor: BillingActor = { name: 'PMCM Admin' }) {
    return this.workflowCommandService.execute<OpsBillingStatement, ReturnType<BillingOperationsService['mapBillingStatement']>>({
      name: 'send_billing_statement',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        const existing = await this.prisma.opsBillingStatement.findUnique({ where: { id: billingId } });
        if (!existing || existing.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      },
      write: () =>
        this.prisma.opsBillingStatement.update({
          where: { id: billingId },
          data: { status: 'sent', sentAt: new Date() },
        }),
      sideEffects: async (billing) => {
        const recipient = billing.clientContact || billing.clientName || 'Client';
        await Promise.all([
          writeAudit(this.auditWriter, eventId, actor.name, `Sent billing statement ${billing.number}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'billing_statement',
            affectedId: billing.id,
            affectedLabel: billing.number,
            metadata: auditMetadata(actor),
          }),
          writeNotification(this.notificationOutboxWriter, eventId, recipient, `Billing statement ${billing.number} sent`, 'email'),
          writeNotification(this.notificationOutboxWriter, eventId, recipient, `Billing statement ${billing.number} sent`, 'viber'),
        ]);
      },
      project: (billing) => this.mapBillingStatement(billing),
    });
  }

  private async prepareBillingStatementStorage(
    eventId: string,
    statementId: string,
    billingNumber: string,
    source: OpsBillingSource,
    pdfBytes: Uint8Array,
    actor: BillingActor,
  ) {
    if (!this.storageObjectService) return { storageState: 'pending', storageObjectId: null, storageKey: '' };
    const storageActorRole = actor.role === OpsUserRole.System ? OpsUserRole.System : OpsUserRole.PmcmAdmin;
    const stored = await this.storageObjectService.requestUpload({
      eventId,
      ownerRecordType: 'billing_statement',
      ownerRecordId: statementId,
      logicalTarget: `billing-statement:${source.id}`,
      usage: 'event_deliverable',
      fileName: `${billingNumber}.pdf`,
      contentType: 'application/pdf',
      declaredByteSize: pdfBytes.byteLength,
      checksumSha256: createHash('sha256').update(pdfBytes).digest('hex'),
      actor: { id: actor.name, name: actor.name, role: storageActorRole, email: actor.email ?? '', eventId, explicit: true },
    });
    let storageState = stored.object.lifecycleState;
    let storageKey = stored.object.providerObjectKey ?? '';
    if (stored.status === 'ready') {
      const confirmed = await this.storageObjectService.confirmUpload({ objectId: stored.object.id, checksumSha256: stored.object.checksumSha256, byteSize: pdfBytes.byteLength, bytes: pdfBytes, actor: { id: actor.name, name: actor.name, role: storageActorRole, email: actor.email ?? '', eventId, explicit: true } });
      storageState = confirmed.lifecycleState;
      storageKey = confirmed.providerObjectKey ?? storageKey;
    }
    return { storageState, storageObjectId: stored.object.id, storageKey };
  }

  async requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput, actor: BillingActor) {
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapBillingCorrection']>>({
      name: 'request_billing_correction', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingCorrection.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing correction idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingCorrection.create({ data: { id: `corr_${randomUUID()}`, eventId, statementId: statement!.id, reason: input.reason.trim(), correctedTotalAmount: input.correctedTotalAmount ?? null, status: 'pending', requestedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (correction, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Requested billing correction for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_correction', affectedId: correction.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { statementId: statement!.id, reason: input.reason, correctedTotalAmount: input.correctedTotalAmount ?? null }) }, context); },
      project: (correction) => this.mapBillingCorrection(correction),
    });
  }

  async resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput, actor: BillingActor) {
    let correction: any = null;
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapBillingCorrection']>>({
      name: 'resolve_billing_correction', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        correction = await this.prisma.opsBillingCorrection.findUnique({ where: { id: correctionId } });
        if (!correction || correction.eventId !== eventId) throw new NotFoundException('Billing correction not found');
        if (correction.status !== 'pending') throw new BadRequestException('Billing correction has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingCorrection.update({ where: { id: correctionId }, data: { status: input.action === 'approve' ? 'approved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes?.trim() ?? null, resolvedAt: new Date() } }),
      sideEffects: async (resolved, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `${input.action === 'approve' ? 'Approved' : 'Rejected'} billing correction`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Update, affectedType: 'billing_correction', affectedId: resolved.id, affectedLabel: resolved.statementId, metadata: auditMetadata(actor, { resolutionNotes: input.resolutionNotes ?? '' }) }, context); },
      project: (resolved) => this.mapBillingCorrection(resolved),
    });
  }

  async createBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor: BillingActor) {
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapBillingDispute']>>({
      name: 'create_billing_dispute', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
        if (input.amount > statement.totalAmount) throw new BadRequestException('Dispute amount cannot exceed the statement total');
        if (input.milestoneId) {
          const milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: input.milestoneId } });
          if (!milestone || milestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
        }
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingDispute.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing dispute idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingDispute.create({ data: { id: `dispute_${randomUUID()}`, eventId, statementId: statement!.id, milestoneId: input.milestoneId ?? null, amount: input.amount, reason: input.reason.trim(), status: 'open', raisedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (dispute, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Opened billing dispute for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { amount: input.amount, reason: input.reason }) }, context); },
      project: (dispute) => this.mapBillingDispute(dispute),
    });
  }

  async resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput, actor: BillingActor) {
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapBillingDispute']>>({
      name: 'resolve_billing_dispute', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const dispute = await this.prisma.opsBillingDispute.findUnique({ where: { id: disputeId } });
        if (!dispute || dispute.eventId !== eventId) throw new NotFoundException('Billing dispute not found');
        if (dispute.status !== 'open') throw new BadRequestException('Billing dispute has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingDispute.update({ where: { id: disputeId }, data: { status: input.action === 'resolve' ? 'resolved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes.trim(), resolvedAt: new Date() } }),
      sideEffects: async (dispute, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Resolved billing dispute`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: dispute.statementId, metadata: auditMetadata(actor, { resolution: input.action, resolutionNotes: input.resolutionNotes }) }, context); },
      project: (dispute) => this.mapBillingDispute(dispute),
    });
  }

  async createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput, actor: BillingActor) {
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let event: Awaited<ReturnType<BillingOperationsService['requireEvent']>> | null = null;
    let issue: { id: string; eventId: string } | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapAdditionalBilling']>>({
      name: 'create_additional_billing', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        event = await this.requireEvent(eventId);
        if (!event.actualEndedAt) throw new BadRequestException('Post-event additional billing requires a recorded event end');
        issue = await this.prisma.opsUrgentIssue.findUnique({ where: { id: input.urgentIssueId }, select: { id: true, eventId: true } });
        if (!issue || issue.eventId !== eventId) throw new NotFoundException('Urgent issue not found');
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsAdditionalBilling.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Additional billing idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsAdditionalBilling.create({ data: { id: `addbill_${randomUUID()}`, eventId, urgentIssueId: issue!.id, description: input.description.trim(), amount: input.amount, status: 'issued', createdBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (billing, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Issued post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: input.description, metadata: auditMetadata(actor, { urgentIssueId: issue!.id, amount: input.amount }) }, context); },
      project: (billing) => this.mapAdditionalBilling(billing),
    });
  }

  async waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput, actor: BillingActor) {
    return this.workflowCommandService.execute<any, ReturnType<BillingOperationsService['mapAdditionalBilling']>>({
      name: 'waive_additional_billing', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const billing = await this.prisma.opsAdditionalBilling.findUnique({ where: { id: additionalBillingId } });
        if (!billing || billing.eventId !== eventId) throw new NotFoundException('Additional billing not found');
        if (billing.status !== 'issued') throw new BadRequestException('Only an issued additional bill can be waived');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsAdditionalBilling.update({ where: { id: additionalBillingId }, data: { status: 'waived', waiverReason: input.reason.trim(), waivedBy: actor.name, waivedAt: new Date() } }),
      sideEffects: async (billing, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Waived post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: billing.description, metadata: auditMetadata(actor, { waiverReason: input.reason }) }, context); },
      project: (billing) => this.mapAdditionalBilling(billing),
    });
  }

  mapBillingCorrection(correction: any) {
    return { id: correction.id, eventId: correction.eventId, statementId: correction.statementId, reason: correction.reason, correctedTotalAmount: correction.correctedTotalAmount ?? null, status: correction.status, requestedBy: correction.requestedBy, resolvedBy: correction.resolvedBy ?? null, resolutionNotes: correction.resolutionNotes ?? null, createdAt: timestamp(correction.createdAt), resolvedAt: correction.resolvedAt ? timestamp(correction.resolvedAt) : null };
  }

  mapBillingDispute(dispute: any) {
    return { id: dispute.id, eventId: dispute.eventId, statementId: dispute.statementId, milestoneId: dispute.milestoneId ?? null, amount: dispute.amount, reason: dispute.reason, status: dispute.status, raisedBy: dispute.raisedBy, resolvedBy: dispute.resolvedBy ?? null, resolutionNotes: dispute.resolutionNotes ?? null, createdAt: timestamp(dispute.createdAt), resolvedAt: dispute.resolvedAt ? timestamp(dispute.resolvedAt) : null };
  }

  mapAdditionalBilling(billing: any) {
    return { id: billing.id, eventId: billing.eventId, urgentIssueId: billing.urgentIssueId, description: billing.description, amount: billing.amount, status: billing.status, createdBy: billing.createdBy, waiverReason: billing.waiverReason ?? null, waivedBy: billing.waivedBy ?? null, createdAt: timestamp(billing.createdAt), waivedAt: billing.waivedAt ? timestamp(billing.waivedAt) : null };
  }

  mapBillingSource(source: OpsBillingSource) {
    return {
      id: source.id,
      eventId: source.eventId,
      sourceType: source.sourceType,
      sourceLabel: source.sourceLabel,
      sourceDocumentId: source.sourceDocumentId ?? null,
      lineItems: Array.isArray(source.lineItems) ? source.lineItems : [],
      paymentSchedule: Array.isArray(source.paymentSchedule) ? source.paymentSchedule : [],
      paymentMethods: Array.isArray(source.paymentMethods) ? source.paymentMethods : [],
      totalAmount: source.totalAmount,
      status: source.status,
      approvedAt: source.approvedAt ? timestamp(source.approvedAt) : null,
      approvedBy: source.approvedBy ?? null,
      approvalNotes: source.approvalNotes,
      paymentTermsPolicyState: source.paymentTermsPolicyState,
      paymentTermsOverrideReason: source.paymentTermsOverrideReason ?? null,
      paymentTermsApprovedBy: source.paymentTermsApprovedBy ?? null,
      createdAt: timestamp(source.createdAt),
      updatedAt: timestamp(source.updatedAt),
    };
  }

  mapBillingStatement(statement: OpsBillingStatement) {
    const expanded = statement as OpsBillingStatement & { sourceId?: string | null };
    return {
      id: statement.id,
      eventId: statement.eventId,
      sourceId: expanded.sourceId ?? null,
      number: statement.number,
      clientName: statement.clientName,
      clientContact: statement.clientContact,
      eventName: statement.eventName,
      eventDate: statement.eventDate ? isoDate(statement.eventDate) : null,
      lineItems: Array.isArray(statement.lineItems) ? statement.lineItems : [],
      paymentSchedule: Array.isArray(statement.paymentSchedule) ? statement.paymentSchedule : [],
      paymentMethods: Array.isArray(statement.paymentMethods) ? statement.paymentMethods : [],
      totalAmount: statement.totalAmount,
      documentId: statement.documentId ?? null,
      pdfUrl: statement.pdfUrl,
      storageKey: statement.storageKey,
      storageObjectId: statement.storageObjectId ?? null,
      storageState: statement.storageState,
      status: statement.status,
      sentAt: statement.sentAt ? timestamp(statement.sentAt) : null,
      generatedAt: timestamp(statement.generatedAt),
    };
  }

  mapPaymentMilestone(payment: OpsPaymentMilestone, history: OpsPaymentRecord[] = []) {
    const amountPaid = payment.amountPaid ?? history.reduce((sum, record) => sum + record.amountReceived, 0);
    const remainingBalance = payment.remainingBalance ?? Math.max(0, payment.amount - amountPaid);
    return {
      id: payment.id,
      eventId: payment.eventId,
      label: payment.label,
      percentage: payment.percentage ?? 50,
      amount: payment.amount,
      amountPaid,
      remainingBalance,
      dueDate: isoDate(payment.dueDate),
      status: payment.status,
      history: history.map((record) => this.mapPaymentRecord(record)),
    };
  }

  mapPaymentRecord(record: OpsPaymentRecord) {
    return {
      id: record.id,
      eventId: record.eventId,
      milestoneId: record.milestoneId,
      amountReceived: record.amountReceived,
      paymentDate: isoDate(record.paymentDate),
      paymentMethod: record.paymentMethod,
      referenceNumber: record.referenceNumber,
      recordedAt: timestamp(record.recordedAt),
    };
  }

  async getPaymentStatusForEvent(eventId: string) {
    await this.requireEvent(eventId);
    const [milestones, records] = await Promise.all([
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId }, orderBy: { recordedAt: 'desc' } }),
    ]);

    const mappedMilestones = milestones.map((payment) =>
      this.mapPaymentMilestone(
        payment,
        records.filter((record) => record.milestoneId === payment.id),
      ),
    );

    return {
      eventId,
      milestones: mappedMilestones,
      paymentRecords: records.map((record) => this.mapPaymentRecord(record)),
      counts: {
        paid: mappedMilestones.filter((payment) => payment.status === 'paid').length,
        pending: mappedMilestones.filter((payment) => payment.status !== 'paid').length,
        atRisk: mappedMilestones.filter((payment) => payment.status === 'at_risk').length,
      },
    };
  }

  private normalizeBillingLineItems(lineItems: BillingLineItemInput[] = []) {
    const normalized = lineItems
      .map((item) => ({
        label: item.label?.trim() ?? '',
        amount: Number(item.amount),
      }))
      .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0);
    if (normalized.length === 0) throw new BadRequestException('At least one billing source line item is required');
    return normalized;
  }

  private normalizeBillingSchedule(schedule: BillingScheduleInput[] | undefined, totalAmount: number) {
    const source =
      schedule && schedule.length > 0
        ? schedule
        : [
            { label: 'Downpayment', percentage: 50 },
            { label: 'Balance', percentage: 50 },
          ];
    const normalized = source.map((item) => ({
      label: item.label?.trim() || 'Payment',
      percentage: Number(item.percentage),
      amount: Math.round((totalAmount * Number(item.percentage)) / 100),
      dueDate: item.dueDate,
    }));
    const amountTotal = normalized.reduce((sum, item) => sum + item.amount, 0);
    if (normalized.length > 0 && amountTotal !== totalAmount) {
      normalized[normalized.length - 1].amount += totalAmount - amountTotal;
    }
    return normalized;
  }

  private normalizeBillingMethods(methods: BillingMethodInput[] | undefined) {
    const source =
      methods && methods.length > 0
        ? methods
        : [
            { label: 'Bank Transfer', details: 'PMCM corporate bank account' },
            { label: 'GCash', details: 'PMCM finance GCash number' },
            { label: 'Cheque', details: 'Payable to PMCM Events Management' },
          ];
    return source.map((item) => ({
      label: item.label?.trim() || 'Payment method',
      details: item.details?.trim() || 'Coordinate with PMCM finance',
    }));
  }

  private asBillingLineItems(value: unknown) {
    return Array.isArray(value) ? (value as Array<{ label: string; amount: number }>) : [];
  }

  private asBillingSchedule(value: unknown, totalAmount: number, eventDate: Date) {
    const raw = Array.isArray(value) ? (value as Array<{ label: string; percentage: number; amount?: number; dueDate?: string }>) : [];
    const defaulted = raw.length > 0 ? raw : this.normalizeBillingSchedule(undefined, totalAmount);
    return defaulted.map((item, index) => ({
      label: item.label,
      percentage: item.percentage,
      amount: item.amount ?? Math.round((totalAmount * item.percentage) / 100),
      dueDate: item.dueDate ?? isoDate(index === 0 ? new Date() : addDays(eventDate, -7)),
    }));
  }

  private asBillingMethods(value: unknown) {
    return Array.isArray(value) ? (value as Array<{ label: string; details: string }>) : this.normalizeBillingMethods(undefined);
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
