import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismVerifiedEventActor } from '@prism/types';
import { renderPaymentReceiptPdf, renderStatementOfAccountPdf } from './documents/billing-documents';
import { StatementOfAccountService } from './statement-of-account.service';

const manilaToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '-');

/**
 * Printable billing documents rendered on request: the statement of account and a receipt for each payment. Each one is
 * read through the statement of account, so the same people see it under the same rules: the event's client once the
 * statement is sent, and PMCM.
 */
@Injectable()
export class BillingDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statements: StatementOfAccountService,
  ) {}

  async statementOfAccountPdf(eventId: string, verifiedActor: PrismVerifiedEventActor, now = new Date()) {
    const statement = await this.statements.statementFor(eventId, verifiedActor);
    if (!statement.available) throw new NotFoundException('The statement of account is not available yet');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { clientName: true, eventDate: true } });
    const pdf = renderStatementOfAccountPdf({ statement, clientName: event?.clientName ?? '', eventDate: event?.eventDate.toISOString().slice(0, 10) ?? null, today: manilaToday(now) });
    return { fileName: safeName(`statement-of-account-${statement.statementNumber ?? eventId}.pdf`), pdf };
  }

  /** A receipt for one payment applied to a payment the reader can see. A payment PMCM undid has no receipt. */
  async paymentReceiptPdf(eventId: string, recordId: string, verifiedActor: PrismVerifiedEventActor) {
    const statement = await this.statements.statementFor(eventId, verifiedActor);
    const record = await this.prisma.opsPaymentRecord.findFirst({
      where: { id: recordId, eventId, reversesRecordId: null },
      select: { id: true, milestoneId: true, amountReceived: true, paymentDate: true, paymentMethod: true, referenceNumber: true, recordedAt: true, reversedBy: { select: { id: true } } },
    });
    const milestone = record ? statement.milestones.find((item) => item.id === record.milestoneId) : undefined;
    if (!record || !milestone) throw new NotFoundException('Payment not found');
    if (record.reversedBy) throw new ConflictException('PMCM undid this payment, so it has no receipt');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { clientName: true } });
    const receiptNumber = `R-${record.id.replace(/^[a-z]+_/, '').slice(0, 8).toUpperCase()}`;
    const pdf = renderPaymentReceiptPdf({
      receiptNumber, clientName: event?.clientName ?? '', eventName: statement.eventName, statementNumber: statement.statementNumber, paymentLabel: milestone.label,
      amount: record.amountReceived, paidOn: record.paymentDate.toISOString().slice(0, 10), method: record.paymentMethod, reference: record.referenceNumber, recordedOn: record.recordedAt.toISOString(),
    });
    return { fileName: safeName(`payment-receipt-${receiptNumber}.pdf`), pdf };
  }
}
