import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { PrismCoordinatorAssignment, PrismCoordinatorAvailability, PrismCoordinatorPoolAvailability, PrismCoordinatorReliabilityHistoryEntry, PrismCoordinatorSuggestion, PrismEventDayTask, PrismSupplierQuoteRequest, PrismUrgentIssue, BlockEventDayTaskInput, CreateEventDayTaskInput, DecideEventTaskReassignmentInput, PrismEventTaskReassignmentRequest, EscalateLiveOpsInput, EscalateEventDayTaskInput, UpdateCoordinatorAttendanceInput, UpdateEventDayTaskInput, UpdateUrgentIssueInput, CreateUrgentIssueInput, VerifySupplierStatusInput, CreateCoordinatorAvailabilityInput, CreateCoordinatorCoverageRequirementInput, CreateEventOperatorDesignationInput, PrismAcknowledgementReminderResult, PrismEventOperatorDesignation, ReplaceCoordinatorAssignmentInput, CreateCoordinatorAssignmentInput, CoordinatorSuggestionsQueryInput } from "@prism/types";

export const operationsCommands = {
revokeEventDayOperator: (eventId: string) => eventOpsClient.liveOps.revokeOperator(eventId),
loadCoordinatorReliabilityHistory: (coordinatorId: string) => request<PrismCoordinatorReliabilityHistoryEntry[]>(
  `/api/pmcm/coordinators/${encodeURIComponent(coordinatorId)}/reliability-history`,
),
assignCoordinator: (eventId: string, input: CreateCoordinatorAssignmentInput) =>
    request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators`, {
      method: "POST",
      body: input,
    }),
createCoordinatorAvailability: (eventId: string, coordinatorId: string, input: CreateCoordinatorAvailabilityInput
  ) => request<PrismCoordinatorAvailability>(
    `/api/events/${eventId}/coordinators/${coordinatorId}/availability`,
    { method: "POST", body: input },
  ),
loadCoordinatorSuggestions: (eventId: string, input: CoordinatorSuggestionsQueryInput) => {
  const query = new URLSearchParams({ role: input.role });
  input.skills.forEach((skill) => query.append("skills", skill));
  return request<PrismCoordinatorSuggestion[]>(
    `/api/events/${eventId}/staffing/coordinator-suggestions?${query.toString()}`,
  );
},
loadCoordinatorPoolAvailability: (eventId: string) =>
  request<PrismCoordinatorPoolAvailability>(`/api/events/${eventId}/staffing/pool-availability`),
createEventDayTask: (eventId: string, input: CreateEventDayTaskInput) => eventOpsClient.liveOps.createTask(eventId, input),
createUrgentIssue: (eventId: string, input: CreateUrgentIssueInput) => eventOpsClient.liveOps.createUrgentIssue(eventId, input),
decidePmcmEventTaskReassignment: (eventId: string, requestId: string, input: DecideEventTaskReassignmentInput) =>
    eventOpsClient.liveOps.decideTaskReassignment(eventId, requestId, input),
deleteCoordinatorAvailability: (eventId: string, coordinatorId: string, availabilityId: string
  ) => request<{ id: string }>(
    `/api/events/${eventId}/coordinators/${coordinatorId}/availability/${availabilityId}`,
    { method: "DELETE" },
  ),
designateEventDayOperator: (eventId: string, input: CreateEventOperatorDesignationInput) => eventOpsClient.liveOps.designateOperator(eventId, input),
getEventDayOperator: (eventId: string) => eventOpsClient.liveOps.operatorDesignation(eventId),
blockEventDayTask: (eventId: string, taskId: string, input: BlockEventDayTaskInput) => eventOpsClient.liveOps.blockTask(eventId, taskId, input),
unblockEventDayTask: (eventId: string, taskId: string) => eventOpsClient.liveOps.unblockTask(eventId, taskId),
escalateEventDayTask: (eventId: string, taskId: string, input: EscalateEventDayTaskInput) => eventOpsClient.liveOps.escalateTask(eventId, taskId, input),
escalateUrgentIssue: (eventId: string, issueId: string, input: EscalateLiveOpsInput) => eventOpsClient.liveOps.escalateUrgentIssue(eventId, issueId, input),
listCoordinatorAvailability: (eventId: string, coordinatorId: string
  ) => request<PrismCoordinatorAvailability[]>(
    `/api/events/${eventId}/coordinators/${coordinatorId}/availability`,
  ),
replaceCoordinator: (eventId: string, assignmentId: string, input: ReplaceCoordinatorAssignmentInput) =>
    request<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>(
      `/api/events/${eventId}/coordinators/${assignmentId}/replace`,
      {
        method: "POST",
        body: input,
      },
    ),
sendCoordinatorAcknowledgementReminders: (eventId: string
  ) => request<PrismAcknowledgementReminderResult>(
    `/api/events/${eventId}/staffing/acknowledgement-reminders`,
    { method: "POST" },
  ),
updateCoordinatorAttendance: (eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) =>
    eventOpsClient.liveOps.updateCoordinatorAttendance(eventId, assignmentId, input),
updateEventDayTask: (eventId: string, taskId: string, input: UpdateEventDayTaskInput) => eventOpsClient.liveOps.updateTask(eventId, taskId, input),
updateUrgentIssue: (eventId: string, issueId: string, input: UpdateUrgentIssueInput) => eventOpsClient.liveOps.updateUrgentIssue(eventId, issueId, input),
upsertCoordinatorCoverage: (eventId: string, input: CreateCoordinatorCoverageRequirementInput
  ) => request<unknown>(
    `/api/events/${eventId}/staffing/coverage`,
    { method: "POST", body: input },
  ),
verifySupplierStatus: (eventId: string, requestId: string, input: VerifySupplierStatusInput) =>
    request<PrismSupplierQuoteRequest>(`/api/events/${eventId}/supplier-status/${requestId}/verify`, {
      method: "PATCH",
      body: input,
    }),
};
