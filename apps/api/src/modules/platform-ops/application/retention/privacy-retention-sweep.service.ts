import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  PLATFORM_RETENTION_READ_MODEL,
  type PlatformRetentionCandidate,
  type PlatformRetentionReadModel,
  type PlatformRetentionSourceCategory,
} from '@prism/contexts/read-models';
import type { PrivacyRetentionCategory } from '@prism/types';
import { AuditService } from '../trust/audit.service';
import { activeLegalHoldWhere } from '../trust/privacy-legal-hold.policy';
import {
  candidateHoldScope,
  isSourceCategory,
  isSweepableCategory,
  retentionCutoff,
  retentionDueSince,
} from './privacy-retention.policy';

export const RETENTION_SWEEP_ACTOR: ResolvedEventOpsActor = {
  id: 'system:privacy-retention-sweep',
  role: OpsUserRole.System,
  name: 'Privacy Retention Sweep',
  email: 'system@prism.local',
  explicit: true,
  verified: true,
};

const EVENT_PAGE_SIZE = 50;
const MAX_EVENT_PAGES_PER_RUN = 200;

export type RetentionSweepCounts = {
  scannedRecords: number;
  created: number;
  held: number;
  released: number;
};

export type RetentionSweepSummary = RetentionSweepCounts & {
  categories: Partial<Record<PrivacyRetentionCategory, RetentionSweepCounts>>;
  complete: boolean;
};

type SweepPolicy = { category: string; periodDays: number };

/**
 * Queues records past their retention period for PMCM review. The sweep never deletes or anonymizes:
 * it creates pending review items, marks items held while a matching legal hold is active, and returns
 * held items to pending once the hold is released. Re-running it is idempotent.
 */
@Injectable()
export class PrivacyRetentionSweepService {
  private readonly logger = new Logger(PrivacyRetentionSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(PLATFORM_RETENTION_READ_MODEL) private readonly retentionReads: PlatformRetentionReadModel,
  ) {}

  async runSweep(now = new Date(), actor: ResolvedEventOpsActor = RETENTION_SWEEP_ACTOR): Promise<RetentionSweepSummary> {
    const policies = await this.prisma.opsRetentionPolicy.findMany({
      where: { enabled: true },
      orderBy: { category: 'asc' },
    });
    const summary: RetentionSweepSummary = { scannedRecords: 0, created: 0, held: 0, released: 0, categories: {}, complete: true };
    for (const policy of policies) {
      if (!isSourceCategory(policy.category as PrivacyRetentionCategory) || !isSweepableCategory(policy.category as PrivacyRetentionCategory)) continue;
      const counts = await this.sweepPolicy(policy, now, actor);
      summary.categories[policy.category as PrivacyRetentionCategory] = counts.counts;
      summary.scannedRecords += counts.counts.scannedRecords;
      summary.created += counts.counts.created;
      summary.held += counts.counts.held;
      summary.released += counts.counts.released;
      if (!counts.complete) summary.complete = false;
    }
    return summary;
  }

  private async sweepPolicy(policy: SweepPolicy, now: Date, actor: ResolvedEventOpsActor) {
    const category = policy.category as PlatformRetentionSourceCategory;
    const archivedBefore = retentionCutoff(now, policy.periodDays);
    const counts: RetentionSweepCounts = { scannedRecords: 0, created: 0, held: 0, released: 0 };
    let afterEventId: string | undefined;
    let complete = false;

    for (let page = 0; page < MAX_EVENT_PAGES_PER_RUN; page += 1) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each page is an event keyset window of EVENT_PAGE_SIZE.
      const result = await this.retentionReads.findRetentionCandidates({
        category,
        archivedBefore,
        afterEventId,
        eventTake: EVENT_PAGE_SIZE,
      });
      for (const candidate of result.candidates) {
        counts.scannedRecords += 1;
        const outcome = await this.reconcileCandidate(policy, candidate, now);
        if (outcome) counts[outcome] += 1;
      }
      if (!result.nextEventCursor) {
        complete = true;
        break;
      }
      afterEventId = result.nextEventCursor;
    }
    if (!complete) {
      this.logger.warn(`Privacy retention sweep stopped at the page limit for ${category}; the next run resumes from the start`);
    }

    if (counts.created || counts.held || counts.released) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => this.auditService.audit(undefined, actor.name, `Privacy retention sweep: ${category}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.General,
        category: AuditCategory.Access,
        affectedType: 'privacy_retention_policy',
        affectedId: category,
        affectedLabel: category,
        metadata: { actorId: actor.id, category, periodDays: policy.periodDays, ...counts },
      }, { prisma: tx, correlationId: `privacy-retention-sweep:${category}:${now.toISOString()}`, actorId: actor.id }));
    }
    return { counts: { ...counts }, complete };
  }

  /** Returns the transition this candidate caused, or null when the item was already in the right state. */
  private async reconcileCandidate(
    policy: SweepPolicy,
    candidate: PlatformRetentionCandidate,
    now: Date,
  ): Promise<'created' | 'held' | 'released' | null> {
    const hold = await this.prisma.opsPrivacyLegalHold.findFirst({
      where: activeLegalHoldWhere(candidateHoldScope(candidate)),
      select: { id: true },
    });
    const status = hold ? 'held' : 'pending';
    const subject = {
      policyCategory: policy.category,
      subjectType: candidate.category,
      subjectId: candidate.subjectId,
    };
    const inserted = await this.prisma.opsRetentionReviewItem.createMany({
      data: [{
        id: `retention_${candidate.category}_${candidate.subjectId}`,
        ...subject,
        eventId: candidate.eventId,
        subjectEmail: candidate.subjectEmail,
        subjectName: candidate.subjectName,
        anchorAt: candidate.anchorAt,
        dueSince: retentionDueSince(candidate.anchorAt, policy.periodDays),
        status,
        createdAt: now,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return status === 'held' ? 'held' : 'created';

    if (hold) {
      const moved = await this.prisma.opsRetentionReviewItem.updateMany({
        where: { ...subject, status: 'pending' },
        data: { status: 'held' },
      });
      return moved.count ? 'held' : null;
    }
    const released = await this.prisma.opsRetentionReviewItem.updateMany({
      where: { ...subject, status: 'held' },
      data: { status: 'pending' },
    });
    return released.count ? 'released' : null;
  }
}

