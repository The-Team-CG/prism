import {
  PRISM_LIFECYCLE_STAGES,
  type PrismClientWorkspace,
  type PrismEvent,
  type PrismPaymentMilestone,
} from "@prism/types";
import type {
  EventProgressSnapshot,
  EventTimelineStep,
  PaymentMilestoneRow,
  ProgressCheckpoint,
} from "./event-progress-types";

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Inquiry accepted",
  conforme: "Conforme signed",
  briefing_proposal: "Briefing & proposal",
  planning: "Planning",
  event_day: "Event day",
  closure_archive: "Closure",
};

export function deriveLifecycleIndex(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): number {
  const hasBriefing = workspace.briefings.some((b) => b.eventId === event.id);
  const floorPlanApproved = workspace.floorPlanDrafts.some(
    (d) => d.eventId === event.id && d.status === "approved",
  );
  const hasBilling = workspace.billingStatements.some(
    (b) => b.eventId === event.id,
  );

  if (event.archived) return 5;
  if (event.status === "event_day" || event.status === "completed") return 4;
  if (floorPlanApproved) return 3;
  if (hasBriefing) return 2;
  if (event.clientPortalStatus === "unlocked") return 1;
  return 0;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function checkpoint(
  id: string,
  label: string,
  done: boolean,
  doneDetail: string,
  pendingDetail: string,
): ProgressCheckpoint {
  return {
    id,
    label,
    detail: done ? doneDetail : pendingDetail,
    done,
    status: done ? "done" : "attention",
  };
}

function documentsAreComplete(docs: { status: string }[]) {
  if (docs.length === 0) return false;
  return !docs.some((doc) => /needs|pending|requested/i.test(doc.status));
}

function documentsDetail(docs: { status: string }[]) {
  if (docs.length === 0) return "No documents uploaded yet";
  return `${countLabel(docs.length, "file", "files")} uploaded`;
}

function billingIsCurrent(
  hasPaidMilestone: boolean,
  billingStatus: string | undefined,
) {
  if (hasPaidMilestone) return true;
  return billingStatus === "paid" || billingStatus === "approved";
}

function billingDetail(
  hasPaidMilestone: boolean,
  billingStatus: string | undefined,
) {
  if (hasPaidMilestone) return "Payments are up to date";
  if (billingStatus) return `Status: ${billingStatus.replaceAll("_", " ")}`;
  return "No billing statement yet";
}

function suppliersDetail(count: number) {
  if (count === 0) return "Pending supplier assignment";
  return `${countLabel(count, "supplier", "suppliers")} assigned`;
}

export function deriveCheckpoints(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): ProgressCheckpoint[] {
  const briefing = workspace.briefings.find((b) => b.eventId === event.id);
  const docs = workspace.documents.filter((d) => d.eventId === event.id);
  const billing = workspace.billingStatements.find(
    (b) => b.eventId === event.id,
  );
  const floorPlanApproved = workspace.floorPlanDrafts.some(
    (d) => d.eventId === event.id && d.status === "approved",
  );
  const supplierQuotes = workspace.supplierQuotes.filter(
    (q) => q.eventId === event.id,
  );
  const hasPaidMilestone = workspace.paymentMilestones.some(
    (m) => m.eventId === event.id && (m.status === "paid" || m.status === "approved"),
  );
  const docsComplete = documentsAreComplete(docs);
  const billingCurrent = billingIsCurrent(hasPaidMilestone, billing?.status);
  const docsText = documentsDetail(docs);
  const billingText = billingDetail(hasPaidMilestone, billing?.status);

  return [
    checkpoint(
      "briefing",
      "Briefing submitted",
      Boolean(briefing),
      `Submitted ${briefing?.submittedAt}`,
      "Awaiting briefing details",
    ),
    checkpoint(
      "floorplan",
      "Floor plan approved",
      floorPlanApproved,
      "Official layout confirmed",
      "PMCM is preparing the layout",
    ),
    checkpoint(
      "suppliers",
      "Suppliers selected",
      supplierQuotes.length > 0,
      suppliersDetail(supplierQuotes.length),
      "Pending supplier assignment",
    ),
    checkpoint("documents", "Documents complete", docsComplete, docsText, docsText),
    checkpoint("billing", "Billing current", billingCurrent, billingText, billingText),
  ];
}

function timelineStatus(done: boolean, current: boolean) {
  if (done) return "completed";
  if (current) return "current";
  return "pending";
}

function timelineStep(
  id: string,
  title: string,
  description: string,
  done: boolean,
  current = false,
): EventTimelineStep {
  return {
    id,
    title,
    description,
    status: timelineStatus(done, current),
  };
}

function isEventDayComplete(event: PrismEvent) {
  return event.status === "event_day" || event.status === "completed";
}

export function deriveTimeline(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): EventTimelineStep[] {
  const portalUnlocked = event.clientPortalStatus === "unlocked";
  const hasBriefing = workspace.briefings.some((b) => b.eventId === event.id);
  const floorPlanApproved = workspace.floorPlanDrafts.some(
    (d) => d.eventId === event.id && d.status === "approved",
  );
  const hasSuppliers = workspace.supplierQuotes.some(
    (q) => q.eventId === event.id,
  );
  const hasCoordinators = workspace.coordinatorAssignments.some(
    (a) => a.eventId === event.id,
  );

  return [
    timelineStep("inquiry", "Inquiry accepted", "Your event request was received and approved", true),
    timelineStep("conforme", "Conforme signed", "Portal access activated", portalUnlocked),
    timelineStep(
      "briefing",
      "Briefing submitted",
      hasBriefing ? "Event details confirmed" : "Awaiting event details",
      hasBriefing,
      portalUnlocked,
    ),
    timelineStep(
      "floorplan",
      "Layout approved",
      floorPlanApproved ? "Official floor plan confirmed" : "PMCM is preparing the layout",
      floorPlanApproved,
      hasBriefing,
    ),
    timelineStep(
      "suppliers",
      "Suppliers assigned",
      hasSuppliers ? "Vendors confirmed for your event" : "Pending supplier selection",
      hasSuppliers,
      floorPlanApproved,
    ),
    timelineStep(
      "coordinators",
      "Team assigned",
      hasCoordinators ? "Event coordinators assigned" : "Pending coordinator assignment",
      hasCoordinators,
      hasSuppliers,
    ),
    timelineStep(
      "event_day",
      "Event day",
      `Scheduled for ${event.eventDate}`,
      isEventDayComplete(event),
    ),
  ];
}

export function derivePaymentMilestones(
  milestones: PrismPaymentMilestone[],
  eventId: string,
): PaymentMilestoneRow[] {
  return milestones
    .filter((m) => m.eventId === eventId)
    .map((m) => ({
      id: m.id,
      label: m.label,
      amount: `₱${m.amount.toLocaleString()}`,
      status: m.status,
      due: m.dueDate,
    }));
}

export function computeEventProgress(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): EventProgressSnapshot {
  const lifecycleIndex = deriveLifecycleIndex(event, workspace);
  const checkpoints = deriveCheckpoints(event, workspace);
  const timeline = deriveTimeline(event, workspace);
  const paymentMilestones = derivePaymentMilestones(
    workspace.paymentMilestones,
    event.id,
  );
  const doneCount = checkpoints.filter((c) => c.done).length;
  const score = Math.round((doneCount / checkpoints.length) * 100);

  return {
    lifecycleStage: STATUS_LABELS[PRISM_LIFECYCLE_STAGES[lifecycleIndex]] ?? "Planning",
    lifecycleIndex,
    checkpoints,
    timeline,
    paymentMilestones,
    score,
  };
}
