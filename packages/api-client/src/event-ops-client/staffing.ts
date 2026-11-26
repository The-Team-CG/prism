import type {
  PrismCoordinatorReplacementRecommendation,
  PrismAcknowledgementReminderResult,
  PrismCoordinatorAssignment,
  PrismCoordinatorAvailability,
  PrismCoordinatorPoolAvailability,
  PrismCoordinatorReliabilityHistoryEntry,
  PrismCoordinatorSuggestion,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createStaffingClient(options: EventOpsClientOptions): Pick<EventOpsClient, "staffing"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  return {
    staffing: {
      reliabilityHistory: (coordinatorId) =>
        prismRequest<PrismCoordinatorReliabilityHistoryEntry[]>(`/pmcm/coordinators/${encodeURIComponent(coordinatorId)}/reliability-history`, withBase(options)),
      assign: (eventId, input) =>
        prismRequest<PrismCoordinatorAssignment>(event(eventId, "/coordinators"), withBase(options, { method: "POST", body: input })),
      replace: (eventId, assignmentId, input) =>
        prismRequest<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>(
          event(eventId, `/coordinators/${assignmentId}/replace`),
          withBase(options, { method: "POST", body: input }),
        ),
      changeRole: (eventId, assignmentId, input) =>
        prismRequest<PrismCoordinatorAssignment>(
          event(eventId, `/coordinators/${assignmentId}/role`),
          withBase(options, { method: "PATCH", body: input }),
        ),
      suggestions: (eventId, input) => {
        const query = new URLSearchParams({ role: input.role });
        input.skills.forEach((skill) => query.append("skills", skill));
        return prismRequest<PrismCoordinatorSuggestion[]>(
          event(eventId, `/staffing/coordinator-suggestions?${query.toString()}`),
          withBase(options),
        );
      },
      poolAvailability: (eventId) =>
        prismRequest<PrismCoordinatorPoolAvailability>(event(eventId, "/staffing/pool-availability"), withBase(options)),
      listAvailability: (eventId, coordinatorId) =>
        prismRequest<PrismCoordinatorAvailability[]>(event(eventId, `/coordinators/${coordinatorId}/availability`), withBase(options)),
      createAvailability: (eventId, coordinatorId, input) =>
        prismRequest<PrismCoordinatorAvailability>(event(eventId, `/coordinators/${coordinatorId}/availability`), withBase(options, { method: "POST", body: input })),
      deleteAvailability: (eventId, coordinatorId, availabilityId) =>
        prismRequest<{ id: string }>(event(eventId, `/coordinators/${coordinatorId}/availability/${availabilityId}`), withBase(options, { method: "DELETE" })),
      replacementRecommendations: (eventId) =>
        prismRequest<PrismCoordinatorReplacementRecommendation[]>(event(eventId, "/coordinator-replacements"), withBase(options)),
      decideReplacement: (eventId, recommendationId, input) =>
        prismRequest<PrismCoordinatorReplacementRecommendation>(event(eventId, `/coordinator-replacements/${recommendationId}/decision`), withBase(options, { method: "POST", body: input })),
      sendAcknowledgementReminders: (eventId) =>
        prismRequest<PrismAcknowledgementReminderResult>(event(eventId, "/staffing/acknowledgement-reminders"), withBase(options, { method: "POST" })),
      upsertCoverage: (eventId, input) =>
        prismRequest<unknown>(event(eventId, "/staffing/coverage"), withBase(options, { method: "POST", body: input })),
    },
  };
}
