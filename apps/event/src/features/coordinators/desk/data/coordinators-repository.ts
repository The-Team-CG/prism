import { defineResource } from "@prism/portal-query";
import type { EventSession } from "@/app/lib/session";
import { eventApi } from "@/lib/prism-api";
import type {
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleView,
  PrismEventDayTask,
  PrismEventTaskReassignmentRequest,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  CoordinatorAssignmentAcknowledgementInput,
  DecideEventTaskReassignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  BlockEventDayTaskInput,
  ReportSupplierSiteStatusInput,
  VerifySupplierStatusInput,
  WithdrawCoordinatorAssignmentInput,
} from "@prism/types";

/** The signed-in coordinator's focus role view; the API resolves the focus event so it loads with the workspace. */
export const coordinatorFocusRoleView = defineResource({
  name: "coordinator.focus-role-view",
  fetch: (_actor: "signed-in", signal) => eventApi.coordinator.focusRoleView({ signal }),
});

export const coordinatorsRepository = {
  loadRoleView(eventId: string) {
    return eventApi.coordinator.roleView(eventId);
  },
  acknowledge(eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput) {
    return eventApi.coordinator.acknowledgeAssignment(eventId, assignmentId, input);
  },
  withdraw(eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput) {
    return eventApi.coordinator.withdrawAssignment(eventId, assignmentId, input);
  },
  createEventDayTask(eventId: string, input: CreateEventDayTaskInput) {
    return eventApi.liveOps.createTask(eventId, input);
  },
  createUrgentIssue(eventId: string, input: CreateUrgentIssueInput) {
    return eventApi.liveOps.createUrgentIssue(eventId, input);
  },
  requestTaskReassignment(eventId: string, taskId: string, input: CreateEventTaskReassignmentInput) {
    return eventApi.liveOps.requestTaskReassignment(eventId, taskId, input);
  },
  decideTaskReassignment(eventId: string, requestId: string, input: DecideEventTaskReassignmentInput) {
    return eventApi.liveOps.decideTaskReassignment(eventId, requestId, input);
  },
  updateOwnAttendance(eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) {
    return eventApi.liveOps.updateCoordinatorAttendance(eventId, assignmentId, input);
  },
  blockOwnTask(eventId: string, taskId: string, input: BlockEventDayTaskInput) {
    return eventApi.liveOps.blockTask(eventId, taskId, input);
  },
  unblockOwnTask(eventId: string, taskId: string) {
    return eventApi.liveOps.unblockTask(eventId, taskId);
  },
  updateOwnTask(eventId: string, taskId: string, input: UpdateEventDayTaskInput) {
    return eventApi.liveOps.updateTask(eventId, taskId, input);
  },
  updateDelegatedAttendance(eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) {
    return eventApi.liveOps.updateCoordinatorAttendance(eventId, assignmentId, input);
  },
  reportSupplierStatus(eventId: string, requestId: string, input: ReportSupplierSiteStatusInput) {
    return eventApi.coordinator.reportSupplierStatus(eventId, requestId, input);
  },
  verifySupplierStatus(eventId: string, requestId: string, input: VerifySupplierStatusInput) {
    return eventApi.commercial.verifySupplierStatus(eventId, requestId, input);
  },
};
