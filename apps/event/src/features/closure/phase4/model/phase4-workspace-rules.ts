const PASSED_TONES = ["approved", "resolved", "overridden", "generated", "sent"];
const OPEN_TONES = ["draft", "issued", "open"];

/** Closure runs in this order; Archive comes last because it is the step that needs the others done. */
export const CLOSURE_TABS = [
  { id: "wrap-up", label: "Wrap up" },
  { id: "feedback", label: "Feedback & reviews" },
  { id: "compliance", label: "Compliance" },
  { id: "deliverables", label: "Deliverables" },
  { id: "archive", label: "Archive" },
] as const;

export type ClosureTabId = (typeof CLOSURE_TABS)[number]["id"];

/** The closure tabs in order, numbered 1–5 from their position. */
export function numberedClosureTabs() {
  return CLOSURE_TABS.map((tab, index) => ({ id: tab.id, label: `${index + 1}. ${tab.label}` }));
}

/** Where a close gate is resolved: a closure tab, or another event tab. */
export type CloseGateDestination =
  | { kind: "closure-tab"; tabId: ClosureTabId; label: string }
  | { kind: "event-tab"; tab: "billing" | "live-ops"; label: string };

const CLOSE_GATE_DESTINATIONS: Record<string, CloseGateDestination> = {
  documents: { kind: "closure-tab", tabId: "deliverables", label: "Open Deliverables" },
  billing: { kind: "event-tab", tab: "billing", label: "Open Billing" },
  logistics: { kind: "closure-tab", tabId: "wrap-up", label: "Open Wrap up" },
  issues: { kind: "event-tab", tab: "live-ops", label: "Open Live ops" },
  feedback: { kind: "closure-tab", tabId: "feedback", label: "Open Feedback & reviews" },
};

export function closeGateDestination(gateKey: string): CloseGateDestination | null {
  return CLOSE_GATE_DESTINATIONS[gateKey] ?? null;
}

/** Sentence case for a status word, so the display does not need CSS capitalisation: "not_applicable" → "Not applicable". */
export function phase4StatusLabel(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Text and dot colour for a closure status, shown as a dot plus label rather than an outlined pill. */
export function phase4StatusTone(value: string, passed?: boolean) {
  if (passed || PASSED_TONES.includes(value)) return "text-success";
  if (OPEN_TONES.includes(value)) return "text-attention";
  return "text-danger";
}

export function phase4ArchiveStatus(archived: boolean, ready?: boolean) {
  if (archived) return { label: "Archived", toneKey: "approved" };
  if (ready) return { label: "Ready for archive", toneKey: "approved" };
  return { label: "Not ready to archive", toneKey: "open" };
}

export function phase4CloseGatesCard(closeGates: { ready: boolean; gates: Array<{ passed: boolean }> } | null) {
  if (!closeGates) {
    return { label: "Close gates", value: "Loading", detail: "Needs PMCM review", tone: "text-attention" };
  }
  const passed = closeGates.gates.filter((gate) => gate.passed).length;
  return {
    label: "Close gates",
    value: `${passed}/${closeGates.gates.length}`,
    detail: closeGates.ready ? "Ready to archive" : "Needs PMCM review",
    tone: closeGates.ready ? "text-success" : "text-attention",
  };
}

export function phase4ComplianceCard(openCount: number, totalCount: number) {
  return {
    label: "Compliance",
    value: openCount,
    detail: `${totalCount} generated check(s)`,
    tone: openCount > 0 ? "text-danger" : "text-success",
  };
}

export function phase4BillingSourceCard(
  approvedSource: { totalAmount: number } | undefined,
  sourceCount: number,
  formatMoney: (amount: number) => string,
) {
  if (approvedSource) {
    return {
      label: "Billing source",
      value: "Approved",
      detail: formatMoney(approvedSource.totalAmount),
      tone: "text-success",
    };
  }
  return {
    label: "Billing source",
    value: sourceCount,
    detail: "Approve before statement",
    tone: "text-attention",
  };
}

export function phase4StatementsCard(statementCount: number, insightReady: boolean) {
  return {
    label: "Statements",
    value: statementCount,
    detail: insightReady ? "Insight ready" : "Insight pending",
    tone: statementCount > 0 ? "text-success" : "text-attention",
  };
}

