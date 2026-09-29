import type {
  PrismCoordinatorWorkspace,
  PrismLiveOps,
  PrismEventDayTask,
  PrismEventTaskReassignmentRequest,
  PrismUrgentIssue,
  PrismCoordinatorAssignment,
  PrismEventSchedule,
  PrismEventScheduleSegment,
  PrismEventRunSheet,
  PrismEventHandoff,
  PrismEventEodReport,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts.js";
import { withBase, actorPath } from "./shared.js";

export function createLiveOpsClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "coordinator" | "liveOps"> {
  return {
    coordinator: {
      workspace: (actor = {}) =>
        prismRequest<PrismCoordinatorWorkspace>(
          actorPath("/coordinator/workspace", actor),
          withBase(options),
        ),
    },
    liveOps: {
      eventDayWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismLiveOps>(
          actorPath(`/events/${eventId}/live-ops`, actor),
          withBase(options),
        ),
      schedule: (eventId, actor = {}) =>
        prismRequest<PrismEventSchedule>(
          actorPath(`/events/${eventId}/schedule`, actor),
          withBase(options),
        ),
      createScheduleDay: (eventId, input, actor = {}) =>
        prismRequest(
          actorPath(`/events/${eventId}/schedule/days`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      createScheduleSegment: (eventId, dayId, input, actor = {}) =>
        prismRequest<PrismEventScheduleSegment>(
          actorPath(
            `/events/${eventId}/schedule/days/${dayId}/segments`,
            actor,
          ),
          withBase(options, { method: "POST", body: input }),
        ),
      updateScheduleSegmentStatus: (eventId, segmentId, input, actor = {}) =>
        prismRequest<PrismEventScheduleSegment>(
          actorPath(
            `/events/${eventId}/schedule/segments/${segmentId}/status`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      runSheet: (eventId, dayId, actor = {}) => {
        const query = dayId ? `?dayId=${encodeURIComponent(dayId)}` : "";
        return prismRequest<
          | PrismEventRunSheet
          | { eventId: string; authored: false; reason: "no_schedule" }
        >(
          actorPath(`/events/${eventId}/run-sheet${query}`, actor),
          withBase(options),
        );
      },
      designateOperator: (eventId, input, actor = {}) =>
        prismRequest(
          actorPath(`/events/${eventId}/operator-designation`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      createHandoff: (eventId, input, actor = {}) =>
        prismRequest<PrismEventHandoff>(
          actorPath(`/events/${eventId}/handoffs`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      listEodReports: (eventId, actor = {}) =>
        prismRequest<PrismEventEodReport[]>(
          actorPath(`/events/${eventId}/eod-reports`, actor),
          withBase(options),
        ),
      submitEodReport: (eventId, input, actor = {}) =>
        prismRequest<PrismEventEodReport>(
          actorPath(`/events/${eventId}/eod-reports`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      replyEodReport: (eventId, reportId, input, actor = {}) =>
        prismRequest<PrismEventEodReport["replies"][number]>(
          actorPath(
            `/events/${eventId}/eod-reports/${reportId}/replies`,
            actor,
          ),
          withBase(options, { method: "POST", body: input }),
        ),
      createTask: (eventId, input, actor = {}) =>
        prismRequest<PrismEventDayTask>(
          actorPath(`/events/${eventId}/event-day/tasks`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateTask: (eventId, taskId, input, actor = {}) =>
        prismRequest<PrismEventDayTask>(
          actorPath(`/events/${eventId}/event-day/tasks/${taskId}`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      listTaskReassignmentRequests: (eventId, actor = {}) =>
        prismRequest<PrismEventTaskReassignmentRequest[]>(
          actorPath(`/events/${eventId}/event-day/task-reassignments`, actor),
          withBase(options),
        ),
      requestTaskReassignment: (eventId, taskId, input, actor = {}) =>
        prismRequest<PrismEventTaskReassignmentRequest>(
          actorPath(
            `/events/${eventId}/event-day/tasks/${taskId}/reassignments`,
            actor,
          ),
          withBase(options, { method: "POST", body: input }),
        ),
      decideTaskReassignment: (eventId, requestId, input, actor = {}) =>
        prismRequest<PrismEventTaskReassignmentRequest>(
          actorPath(
            `/events/${eventId}/event-day/task-reassignments/${requestId}`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateCoordinatorAttendance: (eventId, assignmentId, input, actor = {}) =>
        prismRequest<PrismCoordinatorAssignment>(
          actorPath(
            `/events/${eventId}/coordinators/${assignmentId}/status`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      createUrgentIssue: (eventId, input, actor = {}) =>
        prismRequest<PrismUrgentIssue>(
          actorPath(`/events/${eventId}/urgent-issues`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
    },
  };
}
