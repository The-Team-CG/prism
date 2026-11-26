import type {
  ChangeCoordinatorAssignmentRoleInput,
  DecideCoordinatorReplacementInput,
  PrismCoordinatorReplacementRecommendation,
  CoordinatorSuggestionsQueryInput,
  CreateCoordinatorAssignmentInput,
  CreateCoordinatorAvailabilityInput,
  CreateCoordinatorCoverageRequirementInput,
  PrismAcknowledgementReminderResult,
  PrismCoordinatorAssignment,
  PrismCoordinatorAvailability,
  PrismCoordinatorPoolAvailability,
  PrismCoordinatorReliabilityHistoryEntry,
  PrismCoordinatorSuggestion,
  ReplaceCoordinatorAssignmentInput,
} from "@prism/types";

/** PMCM coordinator staffing: assignments, availability, suggestions and coverage. */
export interface EventOpsStaffingContract {
  staffing: {
    reliabilityHistory(coordinatorId: string): Promise<PrismCoordinatorReliabilityHistoryEntry[]>;
    assign(eventId: string, input: CreateCoordinatorAssignmentInput): Promise<PrismCoordinatorAssignment>;
    replace(
      eventId: string,
      assignmentId: string,
      input: ReplaceCoordinatorAssignmentInput,
    ): Promise<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>;
    /** PMCM moves an assignment to another catalog role the coordinator is tagged for. */
    changeRole(eventId: string, assignmentId: string, input: ChangeCoordinatorAssignmentRoleInput): Promise<PrismCoordinatorAssignment>;
    suggestions(eventId: string, input: CoordinatorSuggestionsQueryInput): Promise<PrismCoordinatorSuggestion[]>;
    poolAvailability(eventId: string): Promise<PrismCoordinatorPoolAvailability>;
    listAvailability(eventId: string, coordinatorId: string): Promise<PrismCoordinatorAvailability[]>;
    createAvailability(eventId: string, coordinatorId: string, input: CreateCoordinatorAvailabilityInput): Promise<PrismCoordinatorAvailability>;
    deleteAvailability(eventId: string, coordinatorId: string, availabilityId: string): Promise<{ id: string }>;
    replacementRecommendations(eventId: string): Promise<PrismCoordinatorReplacementRecommendation[]>;
    decideReplacement(eventId: string, recommendationId: string, input: DecideCoordinatorReplacementInput): Promise<PrismCoordinatorReplacementRecommendation>;
    sendAcknowledgementReminders(eventId: string): Promise<PrismAcknowledgementReminderResult>;
    upsertCoverage(eventId: string, input: CreateCoordinatorCoverageRequirementInput): Promise<unknown>;
  };
}
