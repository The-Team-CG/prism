import type { PARECandidate, PAREContext } from '../pare.types';
import type { PareSupplierCandidateSource } from '@prism/contexts/read-models';

export class SupplierFinderAgent {
  async findPareSupplierCandidates(ctx: PAREContext, suppliers: PareSupplierCandidateSource[], signal?: AbortSignal): Promise<PARECandidate[]> {
    throwIfAborted(signal);
    const { withdrawnSupplier } = ctx;

    const candidates: PARECandidate[] = [];
    const seenNames = new Set<string>();

    for (const supplier of suppliers) {
      throwIfAborted(signal);
      // Deduplicate by name (multiple seed runs can create duplicate supplier records)
      if (seenNames.has(supplier.name)) continue;
      seenNames.add(supplier.name);

      // Skip if already assigned to this event in another role (same category block)
      if (supplier.confirmedOnEvent) continue;

      const reliabilityScore = this.computeReliabilityScore(supplier);
      const halal = this.detectHalal(supplier);
      const priorPmcmEvents = supplier.reviewRatings.length;
      const quotedAmount = supplier.eventQuoteAmount ?? 0;

      const reason = this.buildReason(supplier, reliabilityScore, halal, supplier.eventQuoteAmount);

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

  private computeReliabilityScore(supplier: PareSupplierCandidateSource): number {
    if (supplier.reviewRatings.length === 0) return 0.5; // Unknown — neutral

    const avgRating = supplier.reviewRatings.reduce((sum, rating) => sum + rating, 0) / supplier.reviewRatings.length;
    // Normalize 1-5 rating to 0-1 score
    const score = (avgRating - 1) / 4;
    return Math.round(score * 100) / 100;
  }

  private detectHalal(supplier: PareSupplierCandidateSource): boolean {
    const text = `${supplier.serviceInclusions} ${supplier.performanceNotes}`.toLowerCase();
    return text.includes('halal');
  }

  private buildReason(
    supplier: PareSupplierCandidateSource,
    score: number,
    halal: boolean,
    quoteAmount: number | null,
  ): string {
    const parts: string[] = [];
    parts.push(`Tier ${supplier.tier.replace('tier_', '')}`);
    parts.push(`reliability score ${score}`);
    if (halal) parts.push('halal-certified');
    if (supplier.reviewRatings.length > 0) parts.push(`${supplier.reviewRatings.length} prior PMCM event(s)`);
    if (quoteAmount !== null) parts.push(`quote on file: ₱${quoteAmount.toLocaleString()}`);
    else parts.push('no quote on file for this event');
    return parts.join(', ');
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
}
