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

  return [
    {
      id: "briefing",
      label: "Briefing submitted",
      detail: briefing
        ? `Submitted ${briefing.submittedAt}`
        : "Awaiting briefing details",
      done: Boolean(briefing),
      status: briefing ? "done" : "attention",
    },
    {
      id: "floorplan",
      label: "Floor plan approved",
      detail: floorPlanApproved
        ? "Official layout confirmed"
        : "PMCM is preparing the layout",
      done: floorPlanApproved,
      status: floorPlanApproved ? "done" : "attention",
    },
    {
      id: "suppliers",
      label: "Suppliers selected",
      detail: supplierQuotes.length
        ? `${supplierQuotes.length} supplier${supplierQuotes.length === 1 ? "" : "s"} assigned`
        : "Pending supplier assignment",
      done: supplierQuotes.length > 0,
      status: supplierQuotes.length > 0 ? "done" : "attention",
    },
    {
      id: "documents",
      label: "Documents complete",
      detail: docs.length
        ? `${docs.length} file${docs.length === 1 ? "" : "s"} uploaded`
        : "No documents uploaded yet",
      done: docs.length > 0 && !docs.some((d) => /needs|pending|requested/i.test(d.status)),
      status:
        docs.length > 0 && !docs.some((d) => /needs|pending|requested/i.test(d.status))
          ? "done"
          : "attention",
    },
    {
      id: "billing",
      label: "Billing current",
      detail: hasPaidMilestone
        ? "Payments are up to date"
        : billing
          ? `Status: ${billing.status.replaceAll("_", " ")}`
          : "No billing statement yet",
      done: hasPaidMilestone || billing?.status === "paid" || billing?.status === "approved",
      status:
        hasPaidMilestone || billing?.status === "paid" || billing?.status === "approved"
          ? "done"
          : "attention",
    },
  ];
}

export function deriveTimeline(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): EventTimelineStep[] {
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
    {
      id: "inquiry",
      title: "Inquiry accepted",
      description: "Your event request was received and approved",
      status: "completed",
    },
    {
      id: "conforme",
      title: "Conforme signed",
      description: "Portal access activated",
      status: event.clientPortalStatus === "unlocked" ? "completed" : "pending",
    },
    {
      id: "briefing",
      title: "Briefing submitted",
      description: hasBriefing ? "Event details confirmed" : "Awaiting event details",
      status: hasBriefing ? "completed" : event.clientPortalStatus === "unlocked" ? "current" : "pending",
    },
    {
      id: "floorplan",
      title: "Layout approved",
      description: floorPlanApproved
        ? "Official floor plan confirmed"
        : "PMCM is preparing the layout",
      status: floorPlanApproved
        ? "completed"
        : hasBriefing
          ? "current"
          : "pending",
    },
    {
      id: "suppliers",
      title: "Suppliers assigned",
      description: hasSuppliers
        ? "Vendors confirmed for your event"
        : "Pending supplier selection",
      status: hasSuppliers
        ? "completed"
        : floorPlanApproved
          ? "current"
          : "pending",
    },
    {
      id: "coordinators",
      title: "Team assigned",
      description: hasCoordinators
        ? "Event coordinators assigned"
        : "Pending coordinator assignment",
      status: hasCoordinators
        ? "completed"
        : hasSuppliers
          ? "current"
          : "pending",
    },
    {
      id: "event_day",
      title: "Event day",
      description: `Scheduled for ${event.eventDate}`,
      status: event.status === "event_day" || event.status === "completed"
        ? "completed"
        : "pending",
    },
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
