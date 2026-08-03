import type { PAREContext, PARERisk, PARERiskLevel } from "@prism/types";

/**
 * Step 4 — the deterministic risk verdict.
 *
 * Scores timeline pressure, replacement tier, pricing confidence, first-time
 * bookings and unmet client requirements, then buckets: 5+ is HIGH, 3–4 MEDIUM,
 * below that LOW.
 */
export function assessPareRisk(ctx: PAREContext): PARERisk {
  const factors: string[] = [];
  let score = 0;

  if (ctx.daysUntilEvent <= 7) {
    factors.push(`Critical timeline: event is in ${ctx.daysUntilEvent} day(s)`);
    score += 3;
  } else if (ctx.daysUntilEvent <= 21) {
    factors.push(`Short timeline: event is in ${ctx.daysUntilEvent} days`);
    score += 2;
  } else {
    factors.push(`Adequate timeline: event is in ${ctx.daysUntilEvent} days`);
  }

  const top = ctx.candidates?.[0];
  if (!top) {
    factors.push("No replacement candidates found — high operational risk");
    score += 4;
  } else {
    if (top.tier === "tier_3") {
      factors.push(`Replacement is Tier 3 (${top.supplierName}) — unproven`);
      score += 2;
    } else if (top.tier === "tier_2") {
      factors.push(`Replacement is Tier 2 (${top.supplierName}) — previously worked with PMCM`);
      score += 1;
    } else {
      factors.push(`Replacement is Tier 1 (${top.supplierName}) — preferred partner`);
    }
    if (top.quotedAmount === 0) {
      factors.push("No quote on file — pricing unconfirmed");
      score += 1;
    }
    if (top.priorPmcmEvents === 0) {
      factors.push("No prior events with PMCM — first booking");
      score += 1;
    }
    if (top.reliabilityScore < 0.6) {
      factors.push(`Low reliability score (${top.reliabilityScore})`);
      score += 1;
    }
  }

  const halalRequired = ctx.clientPreferences.some((preference) =>
    preference.toLowerCase().includes("halal"),
  );
  if (halalRequired && top && !top.halal) {
    factors.push("Client requires halal — replacement is NOT halal-certified");
    score += 2;
  }

  const level: PARERiskLevel = score >= 5 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
  const recommendation =
    level === "HIGH"
      ? "Escalate to Ms. Mys immediately. Do not confirm without her explicit sign-off."
      : level === "MEDIUM"
        ? "Proceed with caution. Confirm details and brief client before finalizing."
        : "Proceed with replacement. Standard confirmation and readiness check apply.";

  return { level, factors, recommendation };
}
