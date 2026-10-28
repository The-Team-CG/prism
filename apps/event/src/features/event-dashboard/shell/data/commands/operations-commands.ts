import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { PrismCoordinatorAssignment, PrismCoordinatorAvailability, PrismCoordinatorReliabilityHistoryEntry, PrismCoordinatorSuggestion, PrismEventDayTask, PrismSupplierQuoteRequest, PrismUrgentIssue, CreateEventDayTaskInput, DecideEventTaskReassignmentInput, PrismEventTaskReassignmentRequest, EscalateLiveOpsInput, EscalateEventDayTaskInput, UpdateCoordinatorAttendanceInput, UpdateEventDayTaskInput, UpdateUrgentIssueInput, CreateUrgentIssueInput, VerifySupplierStatusInput, CreateCoordinatorAvailabilityInput, CreateCoordinatorCoverageRequirementInput, CreateEventOperatorDesignationInput, PrismAcknowledgementReminderResult, PrismEventOperatorDesignation, ReplaceCoordinatorAssignmentInput, CreateCoordinatorAssignmentInput, CoordinatorSuggestionsQueryInput } from "@prism/types";

export const operationsCommands = {
revokeEventDayOperator: (eventId: string) => request<PrismEventOperatorDesignation>(`/api/events/${eventId}/operator-designation`, { method: "DELETE" }),
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
createEventDayTask: (eventId: string, input: CreateEventDayTaskInput) =>
    request<PrismEventDayTask>(`/api/events/${eventId}/event-day/tasks`, {
      method: "POST",
      body: input,
    }),
createUrgentIssue: (eventId: string, input: CreateUrgentIssueInput) =>
    request<PrismUrgentIssue>(`/api/events/${eventId}/urgent-issues`, {
      method: "POST",
      body: input,
    }),
decidePmcmEventTaskReassignment: (eventId: string, requestId: string, input: DecideEventTaskReassignmentInput
  ) => request<PrismEventTaskReassignmentRequest>(
    `/api/events/${eventId}/event-day/task-reassignments/${requestId}`,
    { method: "PATCH", body: input },
  ),
deleteCoordinatorAvailability: (eventId: string, coordinatorId: string, availabilityId: string
  ) => request<{ id: string }>(
    `/api/events/${eventId}/coordinators/${coordinatorId}/availability/${availabilityId}`,
    { method: "DELETE" },
  ),
designateEventDayOperator: (eventId: string, input: CreateEventOperatorDesignationInput
  ) => request<unknown>(
    `/api/events/${eventId}/operator-designation`,
    { method: "POST", body: input },
  ),
getEventDayOperator: (eventId: string) => request<PrismEventOperatorDesignation>(
    `/api/events/${eventId}/operator-designation`,
  ),
escalateEventDayTask: (eventId: string, taskId: string, input: EscalateEventDayTaskInput) =>
    request<PrismEventDayTask>(`/api/events/${eventId}/event-day/tasks/${taskId}/escalate`, {
      method: "POST",
      body: input,
    }),
escalateUrgentIssue: (eventId: string, issueId: string, input: EscalateLiveOpsInput) =>
    request<PrismUrgentIssue>(`/api/events/${eventId}/urgent-issues/${issueId}/escalate`, {
      method: "POST",
      body: input,
    }),
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
    request<PrismCoordinatorAssignment>(`/api/events/${eventId}/coordinators/${assignmentId}/status`, {
      method: "PATCH",
      body: input,
    }),
updateEventDayTask: (eventId: string, taskId: string, input: UpdateEventDayTaskInput) =>
    request<PrismEventDayTask>(`/api/events/${eventId}/event-day/tasks/${taskId}`, {
      method: "PATCH",
      body: input,
    }),
updateUrgentIssue: (eventId: string, issueId: string, input: UpdateUrgentIssueInput) =>
    request<PrismUrgentIssue>(`/api/events/${eventId}/urgent-issues/${issueId}`, {
      method: "PATCH",
      body: input,
    }),
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
