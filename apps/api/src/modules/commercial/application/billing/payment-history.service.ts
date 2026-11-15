import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismPaymentHistory } from '@prism/types';
import { buildPaymentHistory } from '../../domain/payment-history.policy';

/** A payment collects a handful of rows over its life; the cap only keeps the read finite. */
const MAX_ROWS = 500;

/** One payment's history for PMCM, read from the records, receipts, disputes and reminders that touched it. */
@Injectable()
export class PaymentHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async history(eventId: string, milestoneId: string): Promise<PrismPaymentHistory> {
    const milestone = await this.prisma.opsPaymentMilestone.findFirst({
      where: { id: milestoneId, eventId },
      select: { id: true, label: true, amount: true, amountPaid: true, remainingBalance: true, dueDate: true, createdAt: true },
    });
    if (!milestone) throw new NotFoundException('Payment milestone not found');
    const [records, disputes, reminders] = await Promise.all([
      this.prisma.opsPaymentRecord.findMany({
        where: { eventId, milestoneId },
        orderBy: { recordedAt: 'asc' },
        take: MAX_ROWS,
        select: { id: true, amountReceived: true, paymentMethod: true, referenceNumber: true, recordedAt: true, recordedBy: true, receiptId: true, reversesRecordId: true, reversalReason: true },
      }),
      this.prisma.opsBillingDispute.findMany({
        where: { eventId, milestoneId },
        take: MAX_ROWS,
        select: { id: true, amount: true, reason: true, raisedBy: true, createdAt: true, status: true, resolvedAt: true, resolvedBy: true, resolutionNotes: true },
      }),
      this.prisma.opsAuditLog.findMany({
        where: { eventId, affectedType: 'payment_milestone', affectedId: milestoneId, action: { startsWith: 'Reminded the client' } },
        take: MAX_ROWS,
        select: { id: true, createdAt: true, actor: true },
      }),
    ]);
    const appliedFrom = [...new Set(records.flatMap((record) => (record.receiptId ? [record.receiptId] : [])))];
    const receipts = await this.prisma.opsPaymentReceipt.findMany({
      where: { eventId, OR: [{ intendedMilestoneId: milestoneId }, { id: { in: appliedFrom } }] },
      take: MAX_ROWS,
      select: {
        id: true, amount: true, method: true, referenceNumber: true, source: true, recordedBy: true, createdAt: true,
        verifiedAt: true, verifiedBy: true, rejectedAt: true, rejectedBy: true, rejectionReason: true,
      },
    });
    return buildPaymentHistory({
      milestone,
      records,
      receipts,
      disputes,
      reminders: reminders.map((row) => ({ id: row.id, at: row.createdAt, by: row.actor })),
    });
  }
}
