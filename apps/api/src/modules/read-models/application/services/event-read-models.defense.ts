type DefenseStatus = "done" | "attention" | "blocked";

export type DefenseAction = {
  key: string;
  label: string;
  detail: string;
  status: DefenseStatus;
  targetTab: string;
};

export type DefenseInputs = {
  eventName: string;
  archived: boolean;
  briefingsCount: number;
  floorPlanDraftsCount: number;
  approvedFloorplan: boolean;
  quoteRequestsCount: number;
  selectedSupplierCount: number;
  coordinatorAssignmentsCount: number;
  pendingCoordinatorCount: number;
  billingStatementsCount: number;
  unpaidMilestoneCount: number;
  openTaskCount: number;
  openIssueCount: number;
  guestCheckInsCount: number;
  pendingFeedbackCount: number;
  closeGates: { ready: boolean; missingKeys: string[] };
};

function statusWhen(done: boolean, attention: boolean, blocked = false): DefenseStatus {
  if (done) return "done";
  if (blocked) return "blocked";
  if (attention) return "attention";
  return "blocked";
}

export function countMatching<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

export function buildDefenseActions(input: DefenseInputs): DefenseAction[] {
  return [
    briefingAction(input),
    floorplanAction(input),
    supplierAction(input),
    coordinatorAction(input),
    billingAction(input),
    liveOpsAction(input),
    closureAction(input),
  ];
}

function briefingAction(input: DefenseInputs): DefenseAction {
  const done = input.briefingsCount > 0;
  return {
    key: "briefing",
    label: "Client briefing",
    detail: done ? "Briefing is on file for planning." : "Submit the confirmed venue, pax, budget, and service notes.",
    status: done ? "done" : "blocked",
    targetTab: "briefing",
  };
}

function floorplanAction(input: DefenseInputs): DefenseAction {
  return {
    key: "floorplan",
    label: "Official floorplan",
    detail: input.approvedFloorplan
      ? "Approved PMCM floorplan is ready for client review."
      : "Create, submit, and approve the official PMCM layout.",
    status: statusWhen(input.approvedFloorplan, input.floorPlanDraftsCount > 0),
    targetTab: "floorplans",
  };
}

function supplierAction(input: DefenseInputs): DefenseAction {
  const done = input.selectedSupplierCount > 0;
  const attention = input.quoteRequestsCount > 0;
  return {
    key: "suppliers",
    label: "Supplier selection",
    detail: done
      ? `${input.selectedSupplierCount} selected supplier quote(s) are locked.`
      : attention
        ? "Quote requests are out; select winning supplier quotes."
        : "Send scoped quote requests to Tier 1 or backup suppliers.",
    status: statusWhen(done, attention),
    targetTab: "suppliers",
  };
}

function coordinatorAction(input: DefenseInputs): DefenseAction {
  const blocked = input.coordinatorAssignmentsCount === 0;
  const attention = input.pendingCoordinatorCount > 0;
  return {
    key: "coordinators",
    label: "Coordinator readiness",
    detail: blocked
      ? "Assign event-day roles before the live run."
      : attention
        ? `${input.pendingCoordinatorCount} coordinator assignment(s) still need acknowledgment.`
        : "Coordinator assignments are acknowledged.",
    status: blocked ? "blocked" : attention ? "attention" : "done",
    targetTab: "coordinators",
  };
}

function billingAction(input: DefenseInputs): DefenseAction {
  const missingStatement = input.billingStatementsCount === 0;
  const unpaid = input.unpaidMilestoneCount > 0;
  return {
    key: "billing",
    label: "Billing and payments",
    detail: missingStatement
      ? "Generate a billing statement from the approved CE/proposal source."
      : unpaid
        ? `${input.unpaidMilestoneCount} payment milestone(s) still need recording.`
        : "Billing statement and payment schedule are closed.",
    status: missingStatement || unpaid ? "attention" : "done",
    targetTab: "billing",
  };
}

function liveOpsAction(input: DefenseInputs): DefenseAction {
  const openItems = input.openTaskCount + input.openIssueCount;
  return {
    key: "live-ops",
    label: "Event-day operations",
    detail:
      openItems > 0
        ? `${input.openTaskCount} open task(s) and ${input.openIssueCount} urgent issue(s) need attention.`
        : "Live-ops board is ready for supplier, coordinator, and attendance signals.",
    status: input.openIssueCount > 0 ? "attention" : "done",
    targetTab: "live-ops",
  };
}

function closureAction(input: DefenseInputs): DefenseAction {
  return {
    key: "closure",
    label: "Closure and archive",
    detail: input.closeGates.ready
      ? "Close gates are complete; archive can proceed."
      : `Close gate(s) still open: ${input.closeGates.missingKeys.join(", ") || "none"}.`,
    status: input.closeGates.ready ? "done" : "attention",
    targetTab: "closure",
  };
}

export function overallDefenseStatus(actions: DefenseAction[]) {
  if (actions.some((action) => action.status === "blocked")) return "blocked";
  if (actions.some((action) => action.status === "attention")) return "attention";
  return "ready";
}

export function defenseLifecycleStage(input: DefenseInputs) {
  if (input.archived) return "archive";
  if (!input.briefingsCount) return "briefing";
  if (!input.approvedFloorplan) return "planning";
  if (input.selectedSupplierCount === 0 || input.pendingCoordinatorCount > 0) return "supplier-coordinator-setup";
  if (input.openTaskCount + input.openIssueCount > 0) return "event-day";
  if (input.closeGates.ready) return "closure-ready";
  return "closure";
}

export function defenseSummary(input: DefenseInputs) {
  return {
    briefingSubmitted: input.briefingsCount > 0,
    officialFloorplanApproved: input.approvedFloorplan,
    quoteRequests: input.quoteRequestsCount,
    selectedSuppliers: input.selectedSupplierCount,
    coordinatorAssignments: input.coordinatorAssignmentsCount,
    pendingCoordinatorAcknowledgments: input.pendingCoordinatorCount,
    openLiveOpsItems: input.openTaskCount + input.openIssueCount,
    billingStatements: input.billingStatementsCount,
    unpaidMilestones: input.unpaidMilestoneCount,
    guestAttendanceCount: input.guestCheckInsCount,
    pendingFeedbackModeration: input.pendingFeedbackCount,
    closureReady: input.closeGates.ready,
  };
}
