import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { PrismCoordinatorAssignment, PrismCoordinatorAvailability, PrismCoordinatorPoolAvailability, PrismCoordinatorReliabilityHistoryEntry, PrismCoordinatorSuggestion, PrismEventDayTask, PrismSupplierQuoteRequest, PrismUrgentIssue, BlockEventDayTaskInput, CreateEventDayTaskInput, DecideEventTaskReassignmentInput, PrismEventTaskReassignmentRequest, EscalateLiveOpsInput, EscalateEventDayTaskInput, UpdateCoordinatorAttendanceInput, UpdateEventDayTaskInput, UpdateUrgentIssueInput, CreateUrgentIssueInput, VerifySupplierStatusInput, CreateCoordinatorAvailabilityInput, CreateCoordinatorCoverageRequirementInput, CreateEventOperatorDesignationInput, PrismAcknowledgementReminderResult, PrismEventOperatorDesignation, ReplaceCoordinatorAssignmentInput, CreateCoordinatorAssignmentInput, CoordinatorSuggestionsQueryInput } from "@prism/types";

export const operationsCommands = {
revokeEventDayOperator: (eventId: string) => eventOpsClient.liveOps.revokeOperator(eventId),
loadCoordinatorReliabilityHistory: (coordinatorId: string) => eventOpsClient.staffing.reliabilityHistory(coordinatorId),
assignCoordinator: (eventId: string, input: CreateCoordinatorAssignmentInput) => eventOpsClient.staffing.assign(eventId, input),
createCoordinatorAvailability: (eventId: string, coordinatorId: string, input: CreateCoordinatorAvailabilityInput) =>
  eventOpsClient.staffing.createAvailability(eventId, coordinatorId, input),
loadCoordinatorSuggestions: (eventId: string, input: CoordinatorSuggestionsQueryInput) => eventOpsClient.staffing.suggestions(eventId, input),
loadCoordinatorPoolAvailability: (eventId: string) => eventOpsClient.staffing.poolAvailability(eventId),
createEventDayTask: (eventId: string, input: CreateEventDayTaskInput) => eventOpsClient.liveOps.createTask(eventId, input),
createUrgentIssue: (eventId: string, input: CreateUrgentIssueInput) => eventOpsClient.liveOps.createUrgentIssue(eventId, input),
decidePmcmEventTaskReassignment: (eventId: string, requestId: string, input: DecideEventTaskReassignmentInput) =>
    eventOpsClient.liveOps.decideTaskReassignment(eventId, requestId, input),
deleteCoordinatorAvailability: (eventId: string, coordinatorId: string, availabilityId: string) =>
  eventOpsClient.staffing.deleteAvailability(eventId, coordinatorId, availabilityId),
designateEventDayOperator: (eventId: string, input: CreateEventOperatorDesignationInput) => eventOpsClient.liveOps.designateOperator(eventId, input),
getEventDayOperator: (eventId: string) => eventOpsClient.liveOps.operatorDesignation(eventId),
blockEventDayTask: (eventId: string, taskId: string, input: BlockEventDayTaskInput) => eventOpsClient.liveOps.blockTask(eventId, taskId, input),
unblockEventDayTask: (eventId: string, taskId: string) => eventOpsClient.liveOps.unblockTask(eventId, taskId),
escalateEventDayTask: (eventId: string, taskId: string, input: EscalateEventDayTaskInput) => eventOpsClient.liveOps.escalateTask(eventId, taskId, input),
escalateUrgentIssue: (eventId: string, issueId: string, input: EscalateLiveOpsInput) => eventOpsClient.liveOps.escalateUrgentIssue(eventId, issueId, input),
listCoordinatorAvailability: (eventId: string, coordinatorId: string) => eventOpsClient.staffing.listAvailability(eventId, coordinatorId),
replaceCoordinator: (eventId: string, assignmentId: string, input: ReplaceCoordinatorAssignmentInput) =>
  eventOpsClient.staffing.replace(eventId, assignmentId, input),
sendCoordinatorAcknowledgementReminders: (eventId: string) => eventOpsClient.staffing.sendAcknowledgementReminders(eventId),
updateCoordinatorAttendance: (eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) =>
    eventOpsClient.liveOps.updateCoordinatorAttendance(eventId, assignmentId, input),
updateEventDayTask: (eventId: string, taskId: string, input: UpdateEventDayTaskInput) => eventOpsClient.liveOps.updateTask(eventId, taskId, input),
updateUrgentIssue: (eventId: string, issueId: string, input: UpdateUrgentIssueInput) => eventOpsClient.liveOps.updateUrgentIssue(eventId, issueId, input),
upsertCoordinatorCoverage: (eventId: string, input: CreateCoordinatorCoverageRequirementInput) =>
  eventOpsClient.staffing.upsertCoverage(eventId, input),
verifySupplierStatus: (eventId: string, requestId: string, input: VerifySupplierStatusInput) =>
    eventOpsClient.commercial.verifySupplierStatus(eventId, requestId, input),
};
