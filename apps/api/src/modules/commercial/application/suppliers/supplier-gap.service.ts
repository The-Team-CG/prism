import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import type { AcknowledgeSupplierGapInput, PrismSupplierGap, RequestSupplierQuotesInput } from '@prism/types';

/** FR-63: PMCM sees supplier gaps per requested category and can acknowledge the risk so the event may proceed. */
@Injectable()
export class SupplierGapService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COMMERCIAL_FACTS_READER) private readonly facts: CommercialFactsReader,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  list(eventId: string): Promise<PrismSupplierGap[]> {
    return this.facts.listSupplierGaps(eventId);
  }

  /**
   * FR-16: asking a Tier 2 supplier while a free Tier 1 supplier rated for this event can serve it needs PMCM's
   * override reason. Requests without explicit suppliers go to Tier 1 only and are never affected.
   */
  async assertTierPolicy(eventId: string, input: RequestSupplierQuotesInput) {
    if (!input.supplierIds?.length || input.tierOverrideReason) return;
    const tier2 = await this.prisma.opsSupplier.count({ where: { id: { in: input.supplierIds }, categoryId: input.categoryId, tier: 'tier_2' } });
    if (tier2 === 0) return;
    const gap = (await this.facts.listSupplierGaps(eventId, undefined, [input.categoryId])).find((item) => item.categoryId === input.categoryId);
    if (gap && !gap.tier2EscalationAllowed) {
      throw new BadRequestException(`${gap.tier1Capable} Tier 1 supplier(s) can serve this event; give an override reason to request Tier 2`);
    }
  }

  /** FR-16: an escalation to Tier 2 over a capable Tier 1 supplier is kept in the audit trail with PMCM's reason. */
  async recordTierOverride(eventId: string, input: RequestSupplierQuotesInput, actor: ResolvedEventOpsActor) {
    if (!input.tierOverrideReason) return;
    await writeAudit(this.auditWriter, eventId, actor.name, `Requested Tier 2 quotes over available Tier 1 suppliers: ${input.tierOverrideReason}`, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Suppliers, actionType: AuditActionType.Update,
      affectedType: 'supplier_category', affectedId: input.categoryId, severity: 'warning',
      metadata: { supplierIds: input.supplierIds ?? [], reason: input.tierOverrideReason, actorId: actor.id ?? null },
    });
  }

  async acknowledge(eventId: string, categoryId: string, input: AcknowledgeSupplierGapInput, actor: ResolvedEventOpsActor): Promise<PrismSupplierGap> {
    return this.prisma.$transaction(async (tx) => {
      const gap = (await this.facts.listSupplierGaps(eventId, tx)).find((item) => item.categoryId === categoryId);
      if (!gap) throw new NotFoundException('No supplier request in that category for this event');
      if (!gap.gap) throw new BadRequestException('This category has an available supplier; there is no gap to acknowledge');
      const row = await tx.opsSupplierGapAcknowledgement.upsert({
        where: { eventId_categoryId: { eventId, categoryId } },
        create: { id: `sga_${randomUUID()}`, eventId, categoryId, reason: input.reason, acknowledgedBy: actor.name },
        update: { reason: input.reason, acknowledgedBy: actor.name, acknowledgedAt: new Date() },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Acknowledged supplier gap: ${gap.categoryName}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Suppliers,
        actionType: AuditActionType.Update,
        affectedType: 'supplier_gap',
        affectedId: row.id,
        affectedLabel: gap.categoryName,
        severity: 'critical',
        metadata: { categoryId, reason: input.reason, actorId: actor.id ?? null },
      }, { prisma: tx, correlationId: `supplier-gap:${eventId}:${categoryId}`, actorId: actor.id });
      return { ...gap, acknowledgement: { reason: row.reason, acknowledgedBy: row.acknowledgedBy, acknowledgedAt: row.acknowledgedAt.toISOString() } };
    });
  }
}
