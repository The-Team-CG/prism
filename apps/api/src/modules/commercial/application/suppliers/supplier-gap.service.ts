import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import type { AcknowledgeSupplierGapInput, PrismSupplierGap } from '@prism/types';

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
