import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventAccessPolicyService, scopeActorToEvent } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import type { PrismStatementOfAccount, PrismVerifiedEventActor } from '@prism/types';
import { LIVE_RECEIPT_STATUSES, receiptBalance } from '../../domain/payment-receipt.policy';
import { buildStatementOfAccount, type StatementViewer } from '../../domain/statement-of-account.policy';

/** An event has a handful of each of these; the bounds only keep every read finite. */
const MAX_ROWS = 2000;

/** A billing statement, its milestones and payments reach the client only after PMCM sends the statement. */
const CLIENT_VISIBLE_STATEMENT = { sentAt: { not: null } } satisfies Prisma.OpsBillingStatementWhereInput;
const CLIENT_VISIBLE_MILESTONE = { OR: [{ statementId: null }, { statement: { is: { sentAt: { not: null } } } }] } satisfies Prisma.OpsPaymentMilestoneWhereInput;

/**
 * The statement of account for one event: what a client sees of its money, and the same view for PMCM. A client reads
 * only their own event, and only once the billing statement has been sent.
 */
@Injectable()
export class StatementOfAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
  ) {}

  /** The statement for the signed-in actor: clients (their own event), PMCM and the system. Everyone else is refused. */
  async statementFor(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<PrismStatementOfAccount> {
    const actor = this.policy.resolveEventScopedActor(verifiedActor);
    const scope = await readEventAccessScope(this.prisma, eventId);
    if (!scope) throw new NotFoundException('Event not found');
    const scoped = scopeActorToEvent(actor, scope);
    await this.policy.requireActorRole(scoped.actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System], 'statement of account', eventId);
    await this.policy.requireCanReadEvent(scoped.actor, scope, 'statement of account', scoped.scope);
    return this.buildStatement(eventId, scope.eventName, scoped.actor.role === OpsUserRole.Client ? 'client' : 'pmcm');
  }

  async buildStatement(eventId: string, eventName: string, viewer: StatementViewer): Promise<PrismStatementOfAccount> {
    const clientView = viewer === 'client';
    const milestoneVisibility = clientView ? CLIENT_VISIBLE_MILESTONE : {};
    const [statement, milestones, records, receipts, openDisputes] = await Promise.all([
      this.prisma.opsBillingStatement.findFirst({
        where: { eventId, ...(clientView ? CLIENT_VISIBLE_STATEMENT : {}) },
        orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
        select: { id: true, number: true, totalAmount: true, sentAt: true, generatedAt: true, paymentMethods: true },
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { eventId, supersededAt: null, ...milestoneVisibility },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        select: { id: true, label: true, dueDate: true, amount: true, amountPaid: true, creditApplied: true, remainingBalance: true, status: true },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
      // Only payments on the milestones the viewer may see: payments on a replaced milestone are carried forward as credit.
      this.prisma.opsPaymentRecord.findMany({
        where: { eventId, milestone: { supersededAt: null, ...milestoneVisibility } },
        orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
        select: { id: true, milestoneId: true, receiptId: true, amountReceived: true, paymentDate: true, paymentMethod: true, referenceNumber: true, reversesRecordId: true },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
      // Live receipts carry credit and refunds; rejected ones are listed so the client learns a payment did not count.
      this.prisma.opsPaymentReceipt.findMany({
        where: { eventId, status: { in: [...LIVE_RECEIPT_STATUSES, 'rejected'] } },
        include: {
          records: { select: { amountReceived: true } },
          refunds: { select: { id: true, amount: true, refundedDate: true, method: true, referenceNumber: true } },
        },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
      this.prisma.opsBillingDispute.findMany({
        where: { eventId, status: 'open' },
        select: { statementId: true, milestoneId: true, amount: true },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
    ]);
    const live = receipts.filter((receipt) => (LIVE_RECEIPT_STATUSES as readonly string[]).includes(receipt.status));
    const figures = buildStatementOfAccount({
      viewer,
      statement,
      milestones,
      records,
      refunds: live.flatMap((receipt) => receipt.refunds),
      receipts: receipts.map((receipt) => ({
        id: receipt.id,
        amount: receipt.amount,
        receivedDate: receipt.receivedDate,
        method: receipt.method,
        referenceNumber: receipt.referenceNumber,
        status: receipt.status,
        source: receipt.source,
        rejectionReason: receipt.rejectionReason,
        intendedMilestoneId: receipt.intendedMilestoneId,
        hasProof: Boolean(receipt.evidenceObjectId),
        unapplied: receiptBalance(receipt.amount, receipt.records, receipt.refunds).unapplied,
        createdAt: receipt.createdAt,
      })),
      openDisputes: openDisputes.filter((dispute) => !statement || dispute.statementId === statement.id),
    });
    return { eventId, eventName, generatedAt: new Date().toISOString(), ...figures };
  }
}
