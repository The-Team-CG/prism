import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsBillingStatement, OpsBillingSource, OpsPaymentMilestone, OpsPaymentRecord, Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory } from '../ops.constants';
import { AuditService } from './audit.service';

export type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
};

type BillingLineItemInput = {
  label: string;
  amount: number;
};

type BillingScheduleInput = {
  label: string;
  percentage: number;
  dueDate?: string;
};

type BillingMethodInput = {
  label: string;
  details: string;
};

export type CreateBillingSourceInput = {
  sourceType?: string;
  sourceLabel: string;
  sourceDocumentId?: string;
  lineItems: BillingLineItemInput[];
  paymentSchedule?: BillingScheduleInput[];
  paymentMethods?: BillingMethodInput[];
};

export type ApproveBillingSourceInput = {
  approvedBy?: string;
  approvalNotes?: string;
};

export type BillingActor = {
  name: string;
  role?: string;
  email?: string;
};

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

export class BillingOperationsService {
  private readonly auditService: AuditService;

  constructor(private readonly prisma: any) {
    this.auditService = new AuditService(prisma);
  }

  async markPayment(eventId: string, milestoneId: string, status: string) {
    await this.requireEvent(eventId);

    const payment = await this.prisma.opsPaymentMilestone
      .update({
        where: { id: milestoneId },
        data: { status },
      })
      .catch(() => {
        throw new NotFoundException('Payment milestone not found');
      });

    await Promise.all([
      this.auditService.audit(eventId, 'PMCM Admin', `Marked ${payment.label} as ${status}`),
      this.auditService.notify(eventId, 'Finance', `${payment.label} ${status}`),
    ]);

    return this.mapPaymentMilestone(payment);
  }

  async recordPayment(eventId: string, milestoneId: string, input: RecordPaymentInput) {
    await this.requireEvent(eventId);

    const milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.eventId !== eventId) {
      throw new NotFoundException('Payment milestone not found');
    }

    if (input.amountReceived <= 0) {
      throw new BadRequestException('Amount received must be greater than zero');
    }

    const paymentDate = parseDate(input.paymentDate);
    const existingHistory = (await this.prisma.opsPaymentRecord.findMany({
      where: { milestoneId },
      orderBy: { paymentDate: 'asc' },
    })) as OpsPaymentRecord[];
    const currentPaid = existingHistory.reduce((sum, record) => sum + record.amountReceived, 0);
    if (currentPaid + input.amountReceived > milestone.amount) {
      throw new BadRequestException('Payment record exceeds remaining milestone balance');
    }

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.opsPaymentRecord.create({
        data: {
          id: `payrec_${randomUUID()}`,
          eventId,
          milestoneId,
          amountReceived: input.amountReceived,
          paymentDate,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber ?? '',
        },
      });

      const history = await tx.opsPaymentRecord.findMany({
        where: { milestoneId },
        orderBy: { paymentDate: 'asc' },
      });
      const amountPaid = history.reduce((sum, record) => sum + record.amountReceived, 0);
      const remainingBalance = Math.max(0, milestone.amount - amountPaid);
      const status = remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';
      const payment = await tx.opsPaymentMilestone.update({
        where: { id: milestoneId },
        data: { amountPaid, remainingBalance, status },
      });

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: 'PMCM Admin',
          action: `Recorded ${input.paymentMethod} payment for ${milestone.label}`,
          category: 'finance',
          actionType: 'create',
          affectedType: 'payment_milestone',
          affectedId: milestoneId,
          affectedLabel: milestone.label,
          metadata: toPrismaJson({
            amountReceived: input.amountReceived,
            referenceNumber: input.referenceNumber ?? '',
          }),
        },
      });

      return { payment, history };
    });

    return this.mapPaymentMilestone(result.payment, result.history);
  }

  async createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor) {
    await this.requireEvent(eventId);

    const lineItems = this.normalizeBillingLineItems(input.lineItems);
    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount <= 0) throw new BadRequestException('Billing source total must be greater than zero');
    const paymentSchedule = this.normalizeBillingSchedule(input.paymentSchedule, totalAmount);
    const paymentMethods = this.normalizeBillingMethods(input.paymentMethods);

    const source = await this.prisma.opsBillingSource.create({
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
    });

    await this.auditService.audit(eventId, actor.name, `Created billing source: ${source.sourceLabel}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Create,
      category: AuditCategory.Finance,
      affectedType: 'billing_source',
      affectedId: source.id,
      affectedLabel: source.sourceLabel,
      metadata: { totalAmount },
    });

    return this.mapBillingSource(source);
  }

  async approveBillingSource(
    eventId: string,
    sourceId: string,
    input: ApproveBillingSourceInput = {},
    actor: BillingActor,
  ) {
    await this.requireEvent(eventId);

    const approvedBy = input.approvedBy?.trim() || actor.name || 'PMCM Admin';
    const source = await this.prisma.opsBillingSource
      .update({
        where: { id: sourceId },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy,
          approvalNotes: input.approvalNotes?.trim() ?? '',
        },
      })
      .catch(() => {
        throw new NotFoundException('Billing source not found');
      });

    if (source.eventId !== eventId) throw new NotFoundException('Billing source not found');

    await this.auditService.audit(eventId, approvedBy, `Approved billing source: ${source.sourceLabel}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Approve,
      category: AuditCategory.Finance,
      affectedType: 'billing_source',
      affectedId: source.id,
      affectedLabel: source.sourceLabel,
      metadata: { totalAmount: source.totalAmount, approvalNotes: input.approvalNotes ?? '' },
    });

    return this.mapBillingSource(source);
  }

  async generateBillingStatement(eventId: string, sourceId?: string) {
    const event = await this.requireEvent(eventId);
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
    const source = sourceId
      ? await this.prisma.opsBillingSource.findUnique({ where: { id: sourceId } })
      : await this.prisma.opsBillingSource.findFirst({ where: { eventId, status: 'approved' } });

    if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
    if (source.status !== 'approved') {
      throw new BadRequestException('Billing source must be approved before generating a billing statement');
    }

    const billingYear = event.eventDate.getFullYear();
    const billingCount = await this.prisma.opsBillingStatement.count();
    const billingNumber = `BS-${billingYear}-${String(billingCount + 1).padStart(4, '0')}`;
    const storageKey = `events/${event.id}/billing/${billingNumber}.pdf`;
    const lineItems = this.asBillingLineItems(source.lineItems);
    const paymentSchedule = this.asBillingSchedule(source.paymentSchedule, source.totalAmount, event.eventDate);
    const paymentMethods = this.asBillingMethods(source.paymentMethods);

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const billingDocument = await tx.opsDocument.create({
        data: {
          id: `doc_${randomUUID()}`,
          eventId: event.id,
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
          sourceId: source.id,
          number: billingNumber,
          clientName: inquiry?.clientName ?? event.clientName,
          clientContact: inquiry?.email ?? '',
          eventName: event.eventName,
          eventDate: event.eventDate,
          lineItems: toPrismaJson(lineItems),
          paymentSchedule: toPrismaJson(paymentSchedule),
          paymentMethods: toPrismaJson(paymentMethods),
          totalAmount: source.totalAmount,
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
          dueDate: parseDate(item.dueDate ?? isoDate(addDays(event.eventDate, -7))),
          status: 'pending',
        })),
      });

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId,
          actor: 'PMCM Admin',
          action: `Generated billing statement ${billingNumber}`,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'billing_statement',
          affectedId: statement.id,
          affectedLabel: billingNumber,
          metadata: toPrismaJson({ sourceId: source.id, sourceLabel: source.sourceLabel, totalAmount: source.totalAmount }),
        },
      });

      return statement;
    });

    return this.mapBillingStatement(result);
  }

  async sendBillingStatement(eventId: string, billingId: string) {
    await this.requireEvent(eventId);

    const existing = await this.prisma.opsBillingStatement.findUnique({ where: { id: billingId } });
    if (!existing || existing.eventId !== eventId) throw new NotFoundException('Billing statement not found');

    const billing = await this.prisma.opsBillingStatement
      .update({
        where: { id: billingId },
        data: { status: 'sent', sentAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException('Billing statement not found');
      });

    await Promise.all([
      this.auditService.audit(eventId, 'PMCM Admin', `Sent billing statement ${billing.number}`),
      this.auditService.notify(eventId, billing.clientContact || billing.clientName || 'Client', `Billing statement ${billing.number} sent`, 'email'),
      this.auditService.notify(eventId, billing.clientContact || billing.clientName || 'Client', `Billing statement ${billing.number} sent`, 'viber'),
    ]);

    return this.mapBillingStatement(billing);
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
