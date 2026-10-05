import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import type { PARECandidate, PAREContext } from '../pare.types';

type PareSupplierCandidate = Prisma.OpsSupplierGetPayload<{
  include: {
    reviews: true;
    certifications: true;
    quoteRequests: true;
    quotes: true;
  };
}>;
type PareSupplierQuote = Prisma.OpsSupplierQuoteGetPayload<{}>;

export class SupplierFinderAgent {
  constructor(private readonly prisma: PrismaService) {}

  async findPareSupplierCandidates(ctx: PAREContext, signal?: AbortSignal): Promise<PARECandidate[]> {
    throwIfAborted(signal);
    const { withdrawnSupplier, eventId } = ctx;

    let category: Prisma.OpsSupplierCategoryGetPayload<{}> | null = null;
    let suppliers: PareSupplierCandidate[] = [];

    try {
      category = await this.prisma.opsSupplierCategory.findFirst({
        where: { name: withdrawnSupplier.category },
      });
      if (!category) return [];

      suppliers = await this.prisma.opsSupplier.findMany({
        where: {
          categoryId: category.id,
          id: { not: withdrawnSupplier.id },
          NOT: { name: withdrawnSupplier.name },
        },
        include: {
          reviews: true,
          certifications: true,
          quoteRequests: { where: { eventId } },
          quotes: { where: { eventId } },
        },
      });
    } catch {
      return [];
    }

    const candidates: PARECandidate[] = [];
    const seenNames = new Set<string>();

    for (const supplier of suppliers) {
      throwIfAborted(signal);
      // Deduplicate by name (multiple seed runs can create duplicate supplier records)
      if (seenNames.has(supplier.name)) continue;
      seenNames.add(supplier.name);

      // Skip if already assigned to this event in another role (same category block)
      const alreadyOnEvent = supplier.quoteRequests.some(
        (request) => request.assignmentStatus === 'confirmed',
      );
      if (alreadyOnEvent) continue;

      const reliabilityScore = this.computeReliabilityScore(supplier);
      const halal = this.detectHalal(supplier);
      const priorPmcmEvents = supplier.reviews.length;

      // Get quote for this event if exists, else 0
      const existingQuote = supplier.quotes[0];
      const quotedAmount = existingQuote?.amount ?? 0;

      const reason = this.buildReason(supplier, reliabilityScore, halal, existingQuote);

      candidates.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        tier: supplier.tier,
        quotedAmount,
        reliabilityScore,
        halal,
        priorPmcmEvents,
        reason,
      });
    }

    // Sort: tier_1 first, then by reliability score descending
    candidates.sort((a, b) => {
      const tierOrder = (t: string) => (t === 'tier_1' ? 0 : t === 'tier_2' ? 1 : 2);
      if (tierOrder(a.tier) !== tierOrder(b.tier)) return tierOrder(a.tier) - tierOrder(b.tier);
      return b.reliabilityScore - a.reliabilityScore;
    });

    return candidates.slice(0, 5); // Top 5
  }

  private computeReliabilityScore(supplier: PareSupplierCandidate): number {
    const reviews = supplier.reviews;
    if (reviews.length === 0) return 0.5; // Unknown — neutral

    const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    // Normalize 1-5 rating to 0-1 score
    const score = (avgRating - 1) / 4;
    return Math.round(score * 100) / 100;
  }

  private detectHalal(supplier: PareSupplierCandidate): boolean {
    const text = `${supplier.serviceInclusions} ${supplier.performanceNotes}`.toLowerCase();
    return text.includes('halal');
  }

  private buildReason(
    supplier: PareSupplierCandidate,
    score: number,
    halal: boolean,
    quote: PareSupplierQuote | undefined,
  ): string {
    const parts: string[] = [];
    parts.push(`Tier ${supplier.tier.replace('tier_', '')}`);
    parts.push(`reliability score ${score}`);
    if (halal) parts.push('halal-certified');
    if (supplier.reviews.length > 0) parts.push(`${supplier.reviews.length} prior PMCM event(s)`);
    if (quote) parts.push(`quote on file: ₱${quote.amount.toLocaleString()}`);
    else parts.push('no quote on file for this event');
    return parts.join(', ');
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
}
