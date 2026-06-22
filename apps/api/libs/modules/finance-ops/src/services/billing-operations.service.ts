import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsBillingStatement, OpsBillingSource, OpsPaymentMilestone, OpsPaymentRecord, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/modules/event-core';
import { NotificationOutboxService } from '@prism/modules/notification-ops';
import { AuditService } from '@prism/modules/trust-ops';
import type {
  ApproveBillingSourceInput,
  BillingActor,
  BillingLineItemInput,
  BillingMethodInput,
  BillingScheduleInput,
  CreateBillingSourceInput,
  RecordPaymentInput,
} from '../ports/finance-commands.port';

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

@Injectable()
export class BillingOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
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
          await this.auditService.audit(event.id, 'System', `Payment at risk for ${event.eventName}`, {
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
    return this.workflowCommandService.execute<OpsPaymentMilestone, ReturnType<BillingOperationsService['mapPaymentMilestone']>>({
      name: 'mark_payment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
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
          this.auditService.audit(eventId, actor.name, `Marked ${payment.label} as ${status}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'payment_milestone',
            affectedId: payment.id,
            affectedLabel: payment.label,
            metadata: auditMetadata(actor),
          }),
          this.notificationOutboxService.queue(eventId, 'Finance', `${payment.label} ${status}`),
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

        if (input.amountReceived <= 0) {
          throw new BadRequestException('Amount received must be greater than zero');
        }

        const existingHistory = (await this.prisma.opsPaymentRecord.findMany({
          where: { milestoneId },
          orderBy: { paymentDate: 'asc' },
        })) as OpsPaymentRecord[];
        const requestedReference = input.referenceNumber?.trim() ?? '';
        paymentDate = parseDate(input.paymentDate);
        const duplicateRecord = requestedReference
          ? existingHistory.find(
              (record) =>
                record.referenceNumber === requestedReference &&
                record.amountReceived === input.amountReceived &&
                isoDate(record.paymentDate) === isoDate(paymentDate!) &&
                record.paymentMethod === input.paymentMethod,
            )
          : null;
        if (duplicateRecord) {
          const amountPaid = existingHistory.reduce((sum, record) => sum + record.amountReceived, 0);
          const remainingBalance = Math.max(0, milestone.amount - amountPaid);
          duplicateReplay = {
            payment: {
              ...milestone,
              amountPaid,
              remainingBalance,
              status: remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
            },
            history: existingHistory,
          };
          return;
        }

        const currentPaid = existingHistory.reduce((sum, record) => sum + record.amountReceived, 0);
        if (currentPaid + input.amountReceived > milestone.amount) {
          throw new BadRequestException('Payment record exceeds remaining milestone balance');
        }
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
        await this.auditService.audit(eventId, actor.name, `Recorded ${input.paymentMethod} payment for ${payment.label}`, {
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

    return this.workflowCommandService.execute<OpsBillingSource, ReturnType<BillingOperationsService['mapBillingSource']>>({
      name: 'create_billing_source',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        lineItems = this.normalizeBillingLineItems(input.lineItems);
        totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        if (totalAmount <= 0) throw new BadRequestException('Billing source total must be greater than zero');
        paymentSchedule = this.normalizeBillingSchedule(input.paymentSchedule, totalAmount);
        paymentMethods = this.normalizeBillingMethods(input.paymentMethods);
      },
      write: () =>
        this.prisma.opsBillingSource.create({
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
          },
        }),
      sideEffects: async (source) => {
        await this.auditService.audit(eventId, actor.name, `Created billing source: ${source.sourceLabel}`, {
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
    const approvedBy = input.approvedBy?.trim() || actor.name || 'PMCM Admin';
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
            approvalNotes: input.approvalNotes?.trim() ?? '',
          },
        }),
      sideEffects: async (approvedSource) => {
        await this.auditService.audit(eventId, approvedBy, `Approved billing source: ${approvedSource.sourceLabel}`, {
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

  async generateBillingStatement(eventId: string, sourceId?: string, actor: BillingActor = { name: 'PMCM Admin' }) {
    let event: Awaited<ReturnType<BillingOperationsService['requireEvent']>> | null = null;
    let inquiry: Awaited<ReturnType<PrismaService['opsInquiry']['findUnique']>> | null = null;
    let source: OpsBillingSource | null = null;
    let billingNumber = '';
    let storageKey = '';
    let lineItems: ReturnType<BillingOperationsService['asBillingLineItems']> = [];
    let paymentSchedule: ReturnType<BillingOperationsService['asBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['asBillingMethods']> = [];

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

        const billingYear = event.eventDate.getFullYear();
        const billingCount = await this.prisma.opsBillingStatement.count();
        billingNumber = `BS-${billingYear}-${String(billingCount + 1).padStart(4, '0')}`;
        storageKey = `events/${event.id}/billing/${billingNumber}.pdf`;
        lineItems = this.asBillingLineItems(source.lineItems);
        paymentSchedule = this.asBillingSchedule(source.paymentSchedule, source.totalAmount, event.eventDate);
        paymentMethods = this.asBillingMethods(source.paymentMethods);
      },
      write: async () => {
        if (!event || !source) throw new NotFoundException('Billing source not found');

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const billingDocument = await tx.opsDocument.create({
            data: {
              id: `doc_${randomUUID()}`,
              eventId: event!.id,
              type: 'billing_statement',
              fileName: `${billingNumber}.pdf`,
              status: 'generated',
              mimeType: 'application/pdf',
              storageBucket: 'document-vault',
              storageKey,
              uploadedByRole: 'system',
            },
          });

          const statement = await tx.opsBillingStatement.create({
            data: {
              id: `bill_${randomUUID()}`,
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
              pdfUrl: `/documents/${storageKey}`,
              storageKey,
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
      sideEffects: async (statement) => {
        await this.auditService.audit(eventId, actor.name, `Generated billing statement ${billingNumber}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'billing_statement',
          affectedId: statement.id,
          affectedLabel: billingNumber,
          metadata: auditMetadata(actor, { sourceId: source?.id, sourceLabel: source?.sourceLabel, totalAmount: source?.totalAmount }),
        });
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
          this.auditService.audit(eventId, actor.name, `Sent billing statement ${billing.number}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'billing_statement',
            affectedId: billing.id,
            affectedLabel: billing.number,
            metadata: auditMetadata(actor),
          }),
          this.notificationOutboxService.queue(eventId, recipient, `Billing statement ${billing.number} sent`, 'email'),
          this.notificationOutboxService.queue(eventId, recipient, `Billing statement ${billing.number} sent`, 'viber'),
        ]);
      },
      project: (billing) => this.mapBillingStatement(billing),
    });
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
