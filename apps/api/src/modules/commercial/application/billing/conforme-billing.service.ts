import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { BillingOperationsService } from './billing-operations.service';

/** Signed conformes older than this are left to PMCM, so a failed issue is not retried for ever. */
const PENDING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 50;

/** The system issues these statements; PMCM still reviews and sends them from Billing. */
const SYSTEM_BILLING_ACTOR = { id: 'system', name: 'P.R.I.S.M', role: OpsUserRole.System, email: 'system@prism.local' } as const;

export type ConformeBillingOutcome =
  | { eventId: string; status: 'issued'; statementId: string }
  | { eventId: string; status: 'skipped'; reason: 'no_issued_proposal' | 'two_packages' }
  | { eventId: string; status: 'failed'; reason: string };

/**
 * UAT 5.3: once the signed conforme activates the client portal, the billing statement is created from the approved
 * proposal on PMCM's standard terms: 50% downpayment now and the balance 7 days before the event. It is issued, not
 * sent; PMCM sends it from Billing. A proposal with two packages, or missing payment details, is left to PMCM.
 */
@Injectable()
export class ConformeBillingService {
  private readonly logger = new Logger(ConformeBillingService.name);
  /** Events already tried in this process, so a failure is reported once rather than every minute. */
  private readonly attempted = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingOperationsService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async issuePending(now = new Date()): Promise<ConformeBillingOutcome[]> {
    const events = await this.prisma.opsEvent.findMany({
      where: { billingRequestedAt: { gte: new Date(now.getTime() - PENDING_WINDOW_MS) }, clientPortalStatus: 'unlocked', archived: false },
      select: { id: true },
      orderBy: { billingRequestedAt: 'asc' },
      take: SWEEP_LIMIT,
    });
    const candidates = events.map((event) => event.id).filter((id) => !this.attempted.has(id));
    if (candidates.length === 0) return [];
    const billed = new Set((await this.prisma.opsBillingSource.findMany({ where: { eventId: { in: candidates } }, select: { eventId: true } })).map((row) => row.eventId));
    const outcomes: ConformeBillingOutcome[] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most SWEEP_LIMIT events, each issued in its own billing commands.
    for (const eventId of candidates.filter((id) => !billed.has(id))) {
      this.attempted.add(eventId);
      outcomes.push(await this.issueForEvent(eventId));
    }
    return outcomes;
  }

  private async issueForEvent(eventId: string): Promise<ConformeBillingOutcome> {
    const proposal = await this.prisma.opsProposalVersion.findFirst({
      where: { eventId, status: 'issued' },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, title: true, totalAmount: true, alternativeTotalAmount: true },
    });
    if (!proposal) return this.leaveToPmcm(eventId, 'no_issued_proposal', 'No issued proposal to bill from; PMCM issues the billing statement');
    if (proposal.alternativeTotalAmount) {
      return this.leaveToPmcm(eventId, 'two_packages', 'The proposal offers two packages; PMCM issues the billing statement for the chosen one');
    }
    const actor = SYSTEM_BILLING_ACTOR;
    const verified = {
      id: actor.id, actorId: actor.id, role: actor.role, actorRole: actor.role, name: actor.name, actorName: actor.name,
      email: actor.email, actorEmail: actor.email, eventId,
    } as unknown as PrismVerifiedEventActor;
    try {
      const source = await this.billing.createBillingSource(eventId, {
        sourceType: 'ce_proposal',
        sourceLabel: `Approved proposal v${proposal.versionNumber}`,
        lineItems: [{ label: proposal.title, amount: proposal.totalAmount }],
        paymentSchedule: [{ label: 'Downpayment (50%)', percentage: 50 }, { label: 'Balance', percentage: 50 }],
        paymentTermsPolicy: 'standard',
        idempotencyKey: `conforme-billing-source:${eventId}`,
      }, actor);
      await this.billing.approveBillingSource(eventId, source.id, { approvalNotes: 'Issued automatically from the approved proposal when the conforme was signed' }, actor);
      const statement = await this.billing.generateBillingStatement(eventId, source.id, actor, verified, `conforme-billing-statement:${eventId}`);
      return { eventId, status: 'issued', statementId: statement.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Billing statement for ${eventId} was not issued automatically: ${reason}`);
      await this.auditSkip(eventId, `Billing statement was not issued automatically after the conforme: ${reason}`);
      return { eventId, status: 'failed', reason };
    }
  }

  private async leaveToPmcm(eventId: string, reason: 'no_issued_proposal' | 'two_packages', message: string): Promise<ConformeBillingOutcome> {
    await this.auditSkip(eventId, message);
    return { eventId, status: 'skipped', reason };
  }

  private auditSkip(eventId: string, action: string) {
    return writeAudit(this.auditWriter, eventId, SYSTEM_BILLING_ACTOR.name, action, {
      actorRole: OpsUserRole.System, actionType: AuditActionType.General, category: AuditCategory.Finance,
      affectedType: 'event', affectedId: eventId, severity: 'warning',
    });
  }
}
