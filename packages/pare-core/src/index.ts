/**
 * `@prism/pare-core` — the PARE engine's decision logic, with no framework or
 * database in it.
 *
 * Consumed by `apps/api` (ai-governance, which owns the audit log and the
 * approval record) and by the `apps/agent-*` eve apps (whose tools expose these
 * same steps to a model). Contracts live in `@prism/types`.
 */

export { buildPareEventContext, extractClientPreferences } from "./context.js";
export {
  MAX_PARE_CANDIDATES,
  computeReliabilityScore,
  detectHalal,
  rankSupplierCandidates,
} from "./scoring.js";
export { analyzePareBudget, noCandidateBudgetAnalysis } from "./budget.js";
export { assessPareRisk } from "./risk.js";
export { draftPareMessages } from "./drafts.js";
export { sanitizePareData, type SanitizedPayload } from "./sanitizer.js";
export { formatPeso } from "./money.js";
export { SAMPLE_PARE_SUPPLIERS, SAMPLE_PARE_TRIGGER } from "./fixtures.js";
