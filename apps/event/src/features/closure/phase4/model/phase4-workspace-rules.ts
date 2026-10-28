const PASSED_TONES = ["approved", "resolved", "overridden", "generated", "sent"];
const OPEN_TONES = ["draft", "issued", "open"];

export function phase4StatusTone(value: string, passed?: boolean) {
  if (passed || PASSED_TONES.includes(value)) return "bg-success-soft text-success ring-success/20";
  if (OPEN_TONES.includes(value)) return "bg-attention-soft text-attention ring-attention/20";
  return "bg-danger-soft text-danger ring-danger/20";
}

export function phase4ArchiveStatus(archived: boolean, ready?: boolean) {
  if (archived) return { label: "Archived", toneKey: "approved" };
  if (ready) return { label: "Ready for archive", toneKey: "approved" };
  return { label: "Archive gated", toneKey: "open" };
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

export function phase4RuleLayer(severity: string) {
  return severity === "watch_out" ? "Should-Fix" : "Must-Fix";
}
