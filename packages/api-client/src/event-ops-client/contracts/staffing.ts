import type {
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
import type { EventOpsActorQuery } from "./primitives";

/** PMCM coordinator staffing: assignments, availability, suggestions and coverage. */
export interface EventOpsStaffingContract {
  staffing: {
    reliabilityHistory(coordinatorId: string, actor?: EventOpsActorQuery): Promise<PrismCoordinatorReliabilityHistoryEntry[]>;
    assign(eventId: string, input: CreateCoordinatorAssignmentInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAssignment>;
    replace(
      eventId: string,
      assignmentId: string,
      input: ReplaceCoordinatorAssignmentInput,
      actor?: EventOpsActorQuery,
    ): Promise<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>;
    suggestions(eventId: string, input: CoordinatorSuggestionsQueryInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorSuggestion[]>;
    poolAvailability(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCoordinatorPoolAvailability>;
    listAvailability(eventId: string, coordinatorId: string, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAvailability[]>;
    createAvailability(eventId: string, coordinatorId: string, input: CreateCoordinatorAvailabilityInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAvailability>;
    deleteAvailability(eventId: string, coordinatorId: string, availabilityId: string, actor?: EventOpsActorQuery): Promise<{ id: string }>;
    sendAcknowledgementReminders(eventId: string, actor?: EventOpsActorQuery): Promise<PrismAcknowledgementReminderResult>;
    upsertCoverage(eventId: string, input: CreateCoordinatorCoverageRequirementInput, actor?: EventOpsActorQuery): Promise<unknown>;
  };
}
