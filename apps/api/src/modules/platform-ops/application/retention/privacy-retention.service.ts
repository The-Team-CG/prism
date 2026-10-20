import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { PLATFORM_RETENTION_READ_MODEL, type PlatformRetentionReadModel, type PlatformRetentionSourceCategory } from '@prism/contexts/read-models';
import type {
  DismissPrivacyRetentionReviewItemInput,
  ExecutePrivacyRetentionReviewItemInput,
  ListPrivacyRetentionReviewItemsQuery,
  PrismRetentionExecutionResult,
  PrismRetentionPolicy,
  PrismRetentionPolicyHistoryEntry,
  PrismRetentionReviewItem,
  PrivacyRetentionCategory,
  UpdatePrivacyRetentionPolicyInput,
} from '@prism/types';
import { AuditService } from '../trust/audit.service';
import { activeLegalHoldWhere, privacyLegalHoldLockKeys } from '../trust/privacy-legal-hold.policy';
import { requireVerifiedTrustActor } from '../trust/verified-trust-actor';
import {
  candidateHoldScope,
  isSourceCategory,
  isSweepableCategory,
  asRetentionAction,
  mapRetentionPolicy,
  parseRetentionHistory,
  RETENTION_HISTORY_LIMIT,
  retentionCutoff,
  sortRetentionPolicies,
  type RetentionPolicyRow,
} from './privacy-retention.policy';
import { PrivacyRetentionExecutorService } from './privacy-retention-executor.service';

const REVIEW_QUEUE_LIMIT = 200;

export type RetentionReviewItemRow = {
  id: string;
  policyCategory: string;
  subjectType: string;
  subjectId: string;
  eventId: string | null;
  subjectEmail: string;
  subjectName: string;
  anchorAt: Date;
  dueSince: Date;
  status: string;
  decisionReason: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

export function mapRetentionReviewItem(row: RetentionReviewItemRow): PrismRetentionReviewItem {
  return {
    id: row.id,
    category: row.policyCategory as PrivacyRetentionCategory,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventId: row.eventId,
    subjectEmail: row.subjectEmail,
    subjectName: row.subjectName,
    anchorAt: row.anchorAt.toISOString(),
    dueSince: row.dueSince.toISOString(),
    status: row.status as PrismRetentionReviewItem['status'],
    decisionReason: row.decisionReason,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function historyToJson(entries: PrismRetentionPolicyHistoryEntry[]): Prisma.InputJsonArray {
  return entries.map((entry) => ({
    revision: entry.revision,
    changedBy: entry.changedBy,
    changedAt: entry.changedAt,
    reason: entry.reason,
    enabled: entry.enabled,
    periodDays: entry.periodDays,
    action: entry.action,
  }));
}

/**
 * Policy configuration and the PMCM review queue. Nothing here deletes or anonymizes on its own:
 * only an explicit operator execution, re-checked against the legal hold and retention period, changes data.
 */
function assertPendingReviewItem(status: string) {
  if (status !== 'pending') {
    throw new BadRequestException('Only pending review items can be executed; a held item waits until its legal hold is released');
  }
}

@Injectable()
export class PrivacyRetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly executor: PrivacyRetentionExecutorService,
    @Inject(PLATFORM_RETENTION_READ_MODEL) private readonly retentionReads: PlatformRetentionReadModel,
  ) {}

  async listPolicies(): Promise<PrismRetentionPolicy[]> {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: the policy table holds exactly one row per retention category (eight rows).
    const rows: RetentionPolicyRow[] = await this.prisma.opsRetentionPolicy.findMany();
    return sortRetentionPolicies(rows).map(mapRetentionPolicy);
  }

  async updatePolicy(
    category: PrivacyRetentionCategory,
    input: UpdatePrivacyRetentionPolicyInput,
    actor: ResolvedEventOpsActor,
    now = new Date(),
  ): Promise<PrismRetentionPolicy> {
    const verifiedActor = this.requireRetentionAdmin(actor, 'privacy retention policy changes');
    if (input.enabled === true && !isSweepableCategory(category)) {
      throw new BadRequestException('This category has no candidate source or redactor, so its policy cannot be enabled');
    }
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy-retention-policy:${category}`}, 0))`; // QUERY_AUDIT_RAW_SQL: serializes edits to one retention policy.
      const existing = await tx.opsRetentionPolicy.findUnique({ where: { category } });
      if (!existing) throw new NotFoundException('Retention policy not found');
      if (existing.revision !== input.expectedRevision) {
        throw new ConflictException('This retention policy changed since it was loaded; reload and try again');
      }
      const before = { enabled: existing.enabled, periodDays: existing.periodDays, action: existing.action };
      const after = {
        enabled: input.enabled ?? existing.enabled,
        periodDays: input.periodDays ?? existing.periodDays,
        action: input.action ?? existing.action,
      };
      const revision = existing.revision + 1;
      const history: PrismRetentionPolicyHistoryEntry[] = [
        ...parseRetentionHistory(existing.history),
        { revision, changedBy: verifiedActor.name, changedAt: now.toISOString(), reason: input.reason, ...after, action: asRetentionAction(after.action) },
      ].slice(-RETENTION_HISTORY_LIMIT);
      const updated = await tx.opsRetentionPolicy.updateMany({
        where: { category, revision: existing.revision },
        data: { ...after, revision, updatedBy: verifiedActor.name, history: historyToJson(history) },
      });
      if (updated.count !== 1) throw new ConflictException('This retention policy changed since it was loaded; reload and try again');

      await this.auditService.audit(undefined, verifiedActor.name, `Updated privacy retention policy: ${category}`, {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_retention_policy',
        affectedId: category,
        affectedLabel: category,
        metadata: { actorId: verifiedActor.id, category, reason: input.reason, revision, before, after },
      }, { prisma: tx, correlationId: `privacy-retention-policy:${category}:${revision}`, actorId: verifiedActor.id });

      return mapRetentionPolicy(await tx.opsRetentionPolicy.findUniqueOrThrow({ where: { category } }));
    });
  }

  async listReviewItems(query: ListPrivacyRetentionReviewItemsQuery): Promise<PrismRetentionReviewItem[]> {
    const rows = await this.prisma.opsRetentionReviewItem.findMany({
      where: {
        ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
        ...(query.category ? { policyCategory: query.category } : {}),
        ...(query.eventId ? { eventId: query.eventId } : {}),
      },
      orderBy: [{ dueSince: 'asc' }, { id: 'asc' }],
      take: REVIEW_QUEUE_LIMIT,
    });
    return rows.map(mapRetentionReviewItem);
  }

  /** Dismisses a review item whose candidate no longer exists; nothing in the subject's data is changed. */
  private async dismissStaleReviewItem(tx: Prisma.TransactionClient, itemId: string, decidedBy: string, now: Date) {
    const closed = await tx.opsRetentionReviewItem.updateMany({
      where: { id: itemId, status: 'pending' },
      data: {
        status: 'dismissed',
        decidedBy,
        decidedAt: now,
        decisionReason: 'No longer matches its retention candidate; nothing was changed',
      },
    });
    if (closed.count !== 1) throw new ConflictException('Retention review item changed; reload and try again');
    return {
      held: false as const,
      item: await tx.opsRetentionReviewItem.findUniqueOrThrow({ where: { id: itemId } }),
      touchedRecords: 0,
      surfaces: [] as string[],
    };
  }

  async executeReviewItem(
    itemId: string,
    input: ExecutePrivacyRetentionReviewItemInput,
    actor: ResolvedEventOpsActor,
    now = new Date(),
  ): Promise<PrismRetentionExecutionResult> {
    const verifiedActor = requireVerifiedTrustActor(actor, 'privacy retention review');
    const outcome = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy-retention-item:${itemId}`}, 0))`; // QUERY_AUDIT_RAW_SQL: serializes operator decisions on one review item.
      const item = await tx.opsRetentionReviewItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Retention review item not found');
      assertPendingReviewItem(item.status);
      if (!item.eventId || !isSourceCategory(item.policyCategory as PrivacyRetentionCategory)) {
        throw new BadRequestException('This review item has no supported retention source');
      }
      const category = item.policyCategory as PlatformRetentionSourceCategory;
      const policy = await tx.opsRetentionPolicy.findUnique({ where: { category: item.policyCategory } });
      if (!policy?.enabled) throw new BadRequestException('The retention policy for this item is disabled');

      // Re-read the subject inside the transaction so the decision uses current data, not the sweep-time snapshot.
      const candidate = await this.retentionReads.findRetentionCandidate(
        { category, subjectId: item.subjectId, eventId: item.eventId },
        { prisma: tx, correlationId: `privacy-retention-item:${item.id}`, actorId: verifiedActor.id },
      );
      if (!candidate) return this.dismissStaleReviewItem(tx, itemId, verifiedActor.name, now);
      if (candidate.anchorAt > retentionCutoff(now, policy.periodDays)) {
        throw new BadRequestException('This record is no longer past its retention period');
      }

      const scope = candidateHoldScope(candidate);
      for (const lockKey of privacyLegalHoldLockKeys(scope)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`; // QUERY_AUDIT_RAW_SQL: same subject lock order as legal-hold placement and release.
      }
      const hold = await tx.opsPrivacyLegalHold.findFirst({ where: activeLegalHoldWhere(scope), select: { id: true } });
      if (hold) {
        await tx.opsRetentionReviewItem.updateMany({ where: { id: itemId, status: 'pending' }, data: { status: 'held' } });
        await this.auditService.audit(item.eventId, verifiedActor.name, 'Privacy retention item held by legal hold', {
          actorRole: verifiedActor.role,
          actorEmail: verifiedActor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Access,
          affectedType: 'privacy_retention_review_item',
          affectedId: item.id,
          affectedLabel: item.policyCategory,
          severity: 'warning',
          metadata: { actorId: verifiedActor.id, itemId: item.id, category: item.policyCategory, holdId: hold.id },
        }, { prisma: tx, correlationId: `privacy-retention-item:${item.id}:held`, actorId: verifiedActor.id });
        return { held: true as const };
      }

      const redaction = await this.executor.redactCandidate(candidate, item.id, tx);
      const decided = await tx.opsRetentionReviewItem.updateMany({
        where: { id: itemId, status: 'pending' },
        data: { status: 'executed', decidedBy: verifiedActor.name, decidedAt: now, decisionReason: input.executionNotes ?? '' },
      });
      if (decided.count !== 1) throw new ConflictException('Retention review item changed; reload and try again');

      await this.auditService.audit(item.eventId, verifiedActor.name, 'Executed privacy retention review item', {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_retention_review_item',
        affectedId: item.id,
        affectedLabel: item.policyCategory,
        metadata: {
          actorId: verifiedActor.id,
          itemId: item.id,
          category: item.policyCategory,
          periodDays: policy.periodDays,
          touchedRecords: redaction.touchedRecords,
          surfaces: redaction.surfaces,
        },
      }, { prisma: tx, correlationId: `privacy-retention-item:${item.id}:execute`, actorId: verifiedActor.id });
      return {
        held: false as const,
        item: await tx.opsRetentionReviewItem.findUniqueOrThrow({ where: { id: itemId } }),
        touchedRecords: redaction.touchedRecords,
        surfaces: redaction.surfaces,
      };
    });
    // Thrown after commit so the held status written above persists.
    if (outcome.held) throw new ConflictException('An active legal hold blocks this record; the review item is now held');
    return { ...mapRetentionReviewItem(outcome.item), touchedRecords: outcome.touchedRecords, surfaces: outcome.surfaces };
  }

  async dismissReviewItem(
    itemId: string,
    input: DismissPrivacyRetentionReviewItemInput,
    actor: ResolvedEventOpsActor,
    now = new Date(),
  ): Promise<PrismRetentionReviewItem> {
    const verifiedActor = requireVerifiedTrustActor(actor, 'privacy retention review');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy-retention-item:${itemId}`}, 0))`; // QUERY_AUDIT_RAW_SQL: serializes operator decisions on one review item.
      const item = await tx.opsRetentionReviewItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Retention review item not found');
      const dismissed = await tx.opsRetentionReviewItem.updateMany({
        where: { id: itemId, status: { in: ['pending', 'held'] } },
        data: { status: 'dismissed', decidedBy: verifiedActor.name, decidedAt: now, decisionReason: input.reason },
      });
      if (dismissed.count !== 1) throw new BadRequestException('Only pending or held review items can be dismissed');
      await this.auditService.audit(item.eventId ?? undefined, verifiedActor.name, 'Dismissed privacy retention review item', {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Decline,
        category: AuditCategory.Access,
        affectedType: 'privacy_retention_review_item',
        affectedId: item.id,
        affectedLabel: item.policyCategory,
        metadata: { actorId: verifiedActor.id, itemId: item.id, category: item.policyCategory, reason: input.reason, fromStatus: item.status },
      }, { prisma: tx, correlationId: `privacy-retention-item:${item.id}:dismiss`, actorId: verifiedActor.id });
      return mapRetentionReviewItem(await tx.opsRetentionReviewItem.findUniqueOrThrow({ where: { id: itemId } }));
    });
  }

  private requireRetentionAdmin(actor: ResolvedEventOpsActor, action: string) {
    const verifiedActor = requireVerifiedTrustActor(actor, action);
    if (verifiedActor.role !== OpsUserRole.PmcmAdmin) {
      throw new ForbiddenException('Only a verified PMCM administrator may change retention policies');
    }
    return verifiedActor;
  }
}
