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
    const [statement, milestones, records, receipts] = await Promise.all([
      this.prisma.opsBillingStatement.findFirst({
        where: { eventId, ...(clientView ? CLIENT_VISIBLE_STATEMENT : {}) },
        orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
        select: { number: true, totalAmount: true, sentAt: true, generatedAt: true },
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
        select: { id: true, amountReceived: true, paymentDate: true, paymentMethod: true, referenceNumber: true, reversesRecordId: true },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
      this.prisma.opsPaymentReceipt.findMany({
        where: { eventId, status: { in: [...LIVE_RECEIPT_STATUSES] } },
        include: {
          records: { select: { amountReceived: true } },
          refunds: { select: { id: true, amount: true, refundedDate: true, method: true, referenceNumber: true } },
        },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: an event has a handful of these; MAX_ROWS only keeps the read finite.
        take: MAX_ROWS,
      }),
    ]);
    const figures = buildStatementOfAccount({
      viewer,
      statement,
      milestones,
      records,
      refunds: receipts.flatMap((receipt) => receipt.refunds),
      creditHeld: receipts.reduce((total, receipt) => total + Math.max(0, receiptBalance(receipt.amount, receipt.records, receipt.refunds).unapplied), 0),
    });
    return { eventId, eventName, generatedAt: new Date().toISOString(), ...figures };
  }
}
