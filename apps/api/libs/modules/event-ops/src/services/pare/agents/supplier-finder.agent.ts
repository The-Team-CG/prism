import type { PARECandidate, PAREContext } from '../pare.types';

export class SupplierFinderAgent {
  constructor(private readonly prisma: any) {}

  async run(ctx: PAREContext): Promise<PARECandidate[]> {
    const { withdrawnSupplier, eventId } = ctx;

    // Find the category by name
    const category = await this.prisma.opsSupplierCategory.findFirst({
      where: { name: withdrawnSupplier.category },
    });
    if (!category) return [];

    // Get all suppliers in same category, excluding the withdrawn one
    const suppliers = await this.prisma.opsSupplier.findMany({
      where: {
        categoryId: category.id,
        id: { not: withdrawnSupplier.id },
      },
      include: {
        reviews: true,
        reliabilityNotes: true,
        certifications: true,
        quoteRequests: {
          where: { eventId },
        },
        quotes: {
          where: { eventId },
        },
      },
    });

    const candidates: PARECandidate[] = [];

    for (const supplier of suppliers) {
      // Skip if already assigned to this event in another role (same category block)
      const alreadyOnEvent = supplier.quoteRequests.some(
        (qr: any) => qr.assignmentStatus === 'confirmed',
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

  private computeReliabilityScore(supplier: any): number {
    const reviews: any[] = supplier.reviews ?? [];
    if (reviews.length === 0) return 0.5; // Unknown — neutral

    const avgRating = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
    // Normalize 1-5 rating to 0-1 score
    const score = (avgRating - 1) / 4;
    return Math.round(score * 100) / 100;
  }

  private detectHalal(supplier: any): boolean {
    const text = `${supplier.serviceInclusions} ${supplier.performanceNotes}`.toLowerCase();
    return text.includes('halal');
  }

  private buildReason(
    supplier: any,
    score: number,
    halal: boolean,
    quote: any,
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
