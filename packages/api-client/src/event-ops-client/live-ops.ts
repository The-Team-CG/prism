import type {
  PrismCoordinatorRoleBrief,
  PrismCoordinatorRoleView,
  PrismSupplierQuoteRequest,
  PrismCoordinatorWorkspace,
  PrismCoordinatorEventSchedule,
  PrismLiveOps,
  PrismEventDayTask,
  PrismEventTaskReassignmentRequest,
  PrismUrgentIssue,
  PrismCoordinatorAssignment,
  PrismEventSchedule,
  PrismEventScheduleSegment,
  PrismEventRunSheetResult,
  PrismEventHandoff,
  PrismEventEodReport,
  PrismHandoffBrief,
  PrismEventOperatorDesignation,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createLiveOpsClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "coordinator" | "liveOps"> {
  return {
    coordinator: {
      workspace: () =>
        prismRequest<PrismCoordinatorWorkspace>(
          "/coordinator/workspace",
          withBase(options),
        ),
      eventSchedule: (eventId) =>
        prismRequest<PrismCoordinatorEventSchedule>(
          `/coordinator/events/${eventId}/schedule`,
          withBase(options),
        ),
      focusRoleView: (init = {}) =>
        prismRequest<PrismCoordinatorRoleView | null>("/coordinator/focus-role-view", withBase(options, { signal: init.signal })),
      roleView: (eventId) =>
        prismRequest<PrismCoordinatorRoleView>(`/coordinator/events/${eventId}/role-view`, withBase(options)),
      acknowledgeAssignment: (eventId, assignmentId, input) =>
        prismRequest<PrismCoordinatorAssignment>(`/events/${eventId}/coordinators/${assignmentId}/acknowledge`, withBase(options, { method: "PATCH", body: input })),
      withdrawAssignment: (eventId, assignmentId, input) =>
        prismRequest<PrismCoordinatorAssignment>(`/events/${eventId}/coordinators/${assignmentId}/withdraw`, withBase(options, { method: "PATCH", body: input })),
      reportSupplierStatus: (eventId, requestId, input) =>
        prismRequest<PrismSupplierQuoteRequest>(`/events/${eventId}/supplier-status/${requestId}/report`, withBase(options, { method: "PATCH", body: input })),
      roleBriefs: (eventId) =>
        prismRequest<PrismCoordinatorRoleBrief[]>(`/events/${eventId}/coordinator-role-briefs`, withBase(options)),
      saveRoleBrief: (eventId, role, input) =>
        prismRequest<PrismCoordinatorRoleBrief>(`/events/${eventId}/coordinator-role-briefs/${encodeURIComponent(role)}`, withBase(options, { method: "PUT", body: input })),
    },
    liveOps: {
      eventDayWorkspace: (eventId) =>
        prismRequest<PrismLiveOps>(
          `/events/${eventId}/live-ops`,
          withBase(options),
        ),
      schedule: (eventId) =>
        prismRequest<PrismEventSchedule>(
          `/events/${eventId}/schedule`,
          withBase(options),
        ),
      createScheduleDay: (eventId, input) =>
        prismRequest(
          `/events/${eventId}/schedule/days`,
          withBase(options, { method: "POST", body: input }),
        ),
      createScheduleSegment: (eventId, dayId, input) =>
        prismRequest<PrismEventScheduleSegment>(
          `/events/${eventId}/schedule/days/${dayId}/segments`,
          withBase(options, { method: "POST", body: input }),
        ),
      updateScheduleSegmentStatus: (eventId, segmentId, input) =>
        prismRequest<PrismEventScheduleSegment>(
          `/events/${eventId}/schedule/segments/${segmentId}/status`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      runSheet: (eventId, dayId) => {
        const path = `/events/${eventId}/run-sheet`;
        const day = dayId
          ? `${path.includes("?") ? "&" : "?"}dayId=${encodeURIComponent(dayId)}`
          : "";
        return prismRequest<PrismEventRunSheetResult>(
          `${path}${day}`,
          withBase(options),
        );
      },
      designateOperator: (eventId, input) =>
        prismRequest(
          `/events/${eventId}/operator-designation`,
          withBase(options, { method: "POST", body: input }),
        ),
      operatorDesignation: (eventId) =>
        prismRequest<PrismEventOperatorDesignation>(
          `/events/${eventId}/operator-designation`,
          withBase(options),
        ),
      revokeOperator: (eventId) =>
        prismRequest<PrismEventOperatorDesignation>(
          `/events/${eventId}/operator-designation`,
          withBase(options, { method: "DELETE" }),
        ),
      createHandoff: (eventId, input) =>
        prismRequest<PrismEventHandoff>(
          `/events/${eventId}/handoffs`,
          withBase(options, { method: "POST", body: input }),
        ),
      listHandoffs: (eventId) =>
        prismRequest<PrismEventHandoff[]>(
          `/events/${eventId}/handoffs`,
          withBase(options),
        ),
      handoffBrief: (eventId) =>
        prismRequest<PrismHandoffBrief>(
          `/events/${eventId}/handoff-brief`,
          withBase(options),
        ),
      listEodReports: (eventId) =>
        prismRequest<PrismEventEodReport[]>(
          `/events/${eventId}/eod-reports`,
          withBase(options),
        ),
      submitEodReport: (eventId, input) =>
        prismRequest<PrismEventEodReport>(
          `/events/${eventId}/eod-reports`,
          withBase(options, { method: "POST", body: input }),
        ),
      replyEodReport: (eventId, reportId, input) =>
        prismRequest<PrismEventEodReport["replies"][number]>(
          `/events/${eventId}/eod-reports/${reportId}/replies`,
          withBase(options, { method: "POST", body: input }),
        ),
      setEodIncompleteTasks: (eventId, reportId, input) =>
        prismRequest<PrismEventEodReport>(
          `/events/${eventId}/eod-reports/${reportId}/incomplete-tasks`,
          withBase(options, { method: "PUT", body: input }),
        ),
      createTask: (eventId, input) =>
        prismRequest<PrismEventDayTask>(
          `/events/${eventId}/event-day/tasks`,
          withBase(options, { method: "POST", body: input }),
        ),
      updateTask: (eventId, taskId, input) =>
        prismRequest<PrismEventDayTask>(
          `/events/${eventId}/event-day/tasks/${taskId}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      blockTask: (eventId, taskId, input) =>
        prismRequest<PrismEventDayTask>(
          `/events/${eventId}/event-day/tasks/${taskId}/block`,
          withBase(options, { method: "POST", body: input }),
        ),
      unblockTask: (eventId, taskId) =>
        prismRequest<PrismEventDayTask>(
          `/events/${eventId}/event-day/tasks/${taskId}/unblock`,
          withBase(options, { method: "POST" }),
        ),
      escalateTask: (eventId, taskId, input) =>
        prismRequest<PrismEventDayTask>(
          `/events/${eventId}/event-day/tasks/${taskId}/escalate`,
          withBase(options, { method: "POST", body: input }),
        ),
      updateUrgentIssue: (eventId, issueId, input) =>
        prismRequest<PrismUrgentIssue>(
          `/events/${eventId}/urgent-issues/${issueId}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      escalateUrgentIssue: (eventId, issueId, input) =>
        prismRequest<PrismUrgentIssue>(
          `/events/${eventId}/urgent-issues/${issueId}/escalate`,
          withBase(options, { method: "POST", body: input }),
        ),
      listTaskReassignmentRequests: (eventId) =>
        prismRequest<PrismEventTaskReassignmentRequest[]>(
          `/events/${eventId}/event-day/task-reassignments`,
          withBase(options),
        ),
      requestTaskReassignment: (eventId, taskId, input) =>
        prismRequest<PrismEventTaskReassignmentRequest>(
          `/events/${eventId}/event-day/tasks/${taskId}/reassignments`,
          withBase(options, { method: "POST", body: input }),
        ),
      decideTaskReassignment: (eventId, requestId, input) =>
        prismRequest<PrismEventTaskReassignmentRequest>(
          `/events/${eventId}/event-day/task-reassignments/${requestId}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateCoordinatorAttendance: (eventId, assignmentId, input) =>
        prismRequest<PrismCoordinatorAssignment>(
          `/events/${eventId}/coordinators/${assignmentId}/status`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      createUrgentIssue: (eventId, input) =>
        prismRequest<PrismUrgentIssue>(
          `/events/${eventId}/urgent-issues`,
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}
