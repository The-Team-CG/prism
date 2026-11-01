const PASSED_TONES = ["approved", "resolved", "overridden", "generated", "sent"];
const OPEN_TONES = ["draft", "issued", "open"];

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

