import type { PAREContext, PAREDrafts } from "@prism/types";

/**
 * Step 5 — the deterministic message drafts.
 *
 * Nothing here sends anything. Both messages are advisory copy the PMCM Admin
 * reviews, edits and sends after approving the recommendation.
 */
export function draftPareMessages(ctx: PAREContext): PAREDrafts {
  const replacement = ctx.budgetAnalysis?.selectedCandidate;
  const replacementName = replacement?.supplierName ?? "a qualified replacement supplier";
  const replacementTier = replacement?.tier?.replace("tier_", "Tier ") ?? "Tier 2";

  const supplierNotification = `Dear ${replacementName} Team,

We are reaching out regarding an urgent assignment opportunity for an upcoming PMCM-managed event.

Event: ${ctx.eventName}
Date: ${ctx.eventDate}
Category Required: ${ctx.withdrawnSupplier.category}

Due to an unforeseen change with our previously assigned ${ctx.withdrawnSupplier.category} supplier, we would like to offer you this engagement. Based on your track record and our records, you are our recommended replacement for this event.

Please confirm your availability and readiness at the earliest opportunity. Our team will follow up with full briefing details and contract terms upon your confirmation.

We value your partnership with PMCM Events and look forward to working with you.

Warm regards,
PMCM Events Coordination Team`.trim();

  const clientReassurance = `Dear ${ctx.clientName},

We are writing to update you regarding your upcoming event, ${ctx.eventName}, on ${ctx.eventDate}.

Our originally assigned ${ctx.withdrawnSupplier.category} supplier has encountered an unforeseen circumstance and will be unable to fulfill their commitment.

We want to assure you that we have already identified a qualified ${replacementTier} replacement — ${replacementName} — who meets your event requirements and has a strong track record with PMCM-managed events. We are coordinating confirmation with them immediately.

Your event plans remain on track, and our team is actively managing this transition on your behalf. You will receive a full update as soon as the replacement is confirmed.

If you have any questions, please do not hesitate to reach out to your PMCM coordinator.

Sincerely,
PMCM Events Management`.trim();

  return { supplierNotification, clientReassurance };
}
