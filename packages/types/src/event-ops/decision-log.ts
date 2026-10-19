import type { PrismDecisionLogKind } from "../schemas/read-model-inputs.js";

/**
 * Read model for the PMCM Decision Log (FL-019). Composed server-side from the dedicated
 * decision, override, waiver, and approval records of one event. Reasons always come from the
 * source record's own reason field; audit rows only supply actor attribution where the source
 * row stores no actor role or name. PMCM-only: never served to client, supplier, guest, or
 * coordinator actors.
 */
export interface PrismDecisionLogActor {
  name: string | null;
  role: string | null;
}

export interface PrismDecisionLogSourceRef {
  /** Source record type, e.g. `event_decision`, `freeze_exception`, `billing_correction`. */
  type: string;
  id: string;
}

export interface PrismDecisionLogEntry {
  /** Stable composite id: `<sourceRef.type>:<sourceRef.id>`. */
  id: string;
  kind: PrismDecisionLogKind;
  /** Decision or outcome, e.g. `approved`, `waived`, `overridden`, `postponed`. */
  decision: string;
  /** What the decision was about, e.g. the compliance check title or requested change. */
  subject: string;
  /** Management reasoning from the source record's dedicated reason field. */
  reason: string | null;
  actor: PrismDecisionLogActor;
  decidedAt: string;
  sourceRef: PrismDecisionLogSourceRef;
}

export interface PrismDecisionLog {
  eventId: string;
  generatedAt: string;
  kind: PrismDecisionLogKind | null;
  page: { index: number; size: number; total: number; hasMore: boolean };
  /** Counts for every kind, independent of the active kind filter and page. */
  kindCounts: Record<PrismDecisionLogKind, number>;
  entries: PrismDecisionLogEntry[];
}
