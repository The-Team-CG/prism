import type { PAREContext, PARETriggerInput } from "@prism/types";

/**
 * prism hardcoded these because no budget ceiling is stored on the event yet.
 * They remain the defaults so ported output is unchanged; pass real figures
 * through `PARETriggerInput` once the event records them.
 */
const DEFAULT_TOTAL_BUDGET = 0;
const DEFAULT_REMAINING_BUDGET = 9999999;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Step 1 — normalize a withdrawal into the context every later step reads. */
export function buildPareEventContext(input: PARETriggerInput): PAREContext {
  const eventDate = new Date(input.event.eventDate);
  const now = input.now ? new Date(input.now) : new Date();
  const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / MS_PER_DAY);

  const selectedQuotes = input.selectedQuotes ?? [];
  const spentBudget = selectedQuotes.reduce((sum, quote) => sum + (quote.amount ?? 0), 0);
  const withdrawnQuote = selectedQuotes.find((quote) => quote.requestId === input.triggerId);

  return {
    triggerId: input.triggerId,
    eventId: input.event.id,
    eventName: input.event.eventName,
    eventDate: eventDate.toISOString().slice(0, 10),
    daysUntilEvent,
    clientName: input.event.clientName,
    totalBudget: input.totalBudget ?? DEFAULT_TOTAL_BUDGET,
    spentBudget,
    remainingBudget: input.remainingBudget ?? DEFAULT_REMAINING_BUDGET,
    withdrawnSupplier: {
      id: input.withdrawnRequest.supplierId ?? "",
      name: input.withdrawnRequest.supplierName,
      category: input.withdrawnRequest.category,
      tier: input.withdrawnRequest.supplierTier ?? "unknown",
      quotedAmount: withdrawnQuote?.amount ?? 0,
    },
    clientPreferences: extractClientPreferences(input.briefingServiceRequirements),
  };
}

/**
 * Briefing `serviceRequirements` is untyped JSON: either a list of requirement
 * strings or a flat `{ key: value }` record. Both shapes flatten to labels.
 */
export function extractClientPreferences(requirements: unknown): string[] {
  const preferences: string[] = [];
  if (Array.isArray(requirements)) {
    for (const value of requirements) {
      if (typeof value === "string" && value.trim()) preferences.push(value);
    }
    return preferences;
  }
  if (typeof requirements === "object" && requirements !== null) {
    for (const [key, value] of Object.entries(requirements as Record<string, unknown>)) {
      if (value && typeof value !== "object") preferences.push(`${key}: ${value}`);
    }
  }
  return preferences;
}
