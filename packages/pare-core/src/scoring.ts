import type { PARECandidate, PAREContext, PARESupplierRecord } from "@prism/types";
import { formatPeso } from "./money.js";

/** PARE shortlists at most five replacements. */
export const MAX_PARE_CANDIDATES = 5;

/** No reviews on file is neither good nor bad. */
const UNKNOWN_RELIABILITY = 0.5;

/**
 * Step 2 — rank replacement candidates for the withdrawn supplier's category.
 *
 * The category filter and the withdrawn-supplier exclusion were SQL predicates
 * in the original query; they are applied here too so a caller can hand over an
 * unfiltered directory. A row with no `categoryName` is trusted as already
 * scoped.
 */
export function rankSupplierCandidates(
  context: Pick<PAREContext, "withdrawnSupplier">,
  suppliers: PARESupplierRecord[],
): PARECandidate[] {
  const { withdrawnSupplier } = context;
  const candidates: PARECandidate[] = [];
  const seenNames = new Set<string>();

  for (const supplier of suppliers) {
    if (
      supplier.categoryName !== undefined &&
      supplier.categoryName !== null &&
      supplier.categoryName !== withdrawnSupplier.category
    ) {
      continue;
    }

    if (supplier.id === withdrawnSupplier.id || supplier.name === withdrawnSupplier.name) continue;

    // Deduplicate by name — repeated seed runs create duplicate supplier records.
    if (seenNames.has(supplier.name)) continue;
    seenNames.add(supplier.name);

    // Skip anyone already confirmed on this event in another role.
    const alreadyOnEvent = (supplier.quoteRequests ?? []).some(
      (request) => request.assignmentStatus === "confirmed",
    );
    if (alreadyOnEvent) continue;

    const reliabilityScore = computeReliabilityScore(supplier);
    const halal = detectHalal(supplier);
    const reviews = supplier.reviews ?? [];
    const existingQuote = (supplier.quotes ?? [])[0];

    candidates.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      tier: supplier.tier,
      quotedAmount: existingQuote?.amount ?? 0,
      reliabilityScore,
      halal,
      priorPmcmEvents: reviews.length,
      reason: buildReason(supplier, reliabilityScore, halal, existingQuote),
    });
  }

  // tier_1 first, then strongest reliability.
  candidates.sort((a, b) => {
    if (tierOrder(a.tier) !== tierOrder(b.tier)) return tierOrder(a.tier) - tierOrder(b.tier);
    return b.reliabilityScore - a.reliabilityScore;
  });

  return candidates.slice(0, MAX_PARE_CANDIDATES);
}

function tierOrder(tier: string): number {
  return tier === "tier_1" ? 0 : tier === "tier_2" ? 1 : 2;
}

/** Average review rating normalized from a 1–5 scale onto 0–1, two decimals. */
export function computeReliabilityScore(supplier: PARESupplierRecord): number {
  const reviews = supplier.reviews ?? [];
  if (reviews.length === 0) return UNKNOWN_RELIABILITY;

  const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return Math.round(((avgRating - 1) / 4) * 100) / 100;
}

export function detectHalal(supplier: PARESupplierRecord): boolean {
  return `${supplier.serviceInclusions} ${supplier.performanceNotes}`.toLowerCase().includes("halal");
}

function buildReason(
  supplier: PARESupplierRecord,
  score: number,
  halal: boolean,
  quote: { amount?: number | null } | undefined,
): string {
  const reviews = supplier.reviews ?? [];
  const parts: string[] = [
    `Tier ${supplier.tier.replace("tier_", "")}`,
    `reliability score ${score}`,
  ];
  if (halal) parts.push("halal-certified");
  if (reviews.length > 0) parts.push(`${reviews.length} prior PMCM event(s)`);
  if (quote) parts.push(`quote on file: ${formatPeso(quote.amount ?? 0)}`);
  else parts.push("no quote on file for this event");
  return parts.join(", ");
}
