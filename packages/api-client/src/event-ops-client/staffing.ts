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
import { withBase, actorPath } from "./shared";

export function createStaffingClient(options: EventOpsClientOptions): Pick<EventOpsClient, "staffing"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  return {
    staffing: {
      reliabilityHistory: (coordinatorId, actor = {}) =>
        prismRequest<PrismCoordinatorReliabilityHistoryEntry[]>(actorPath(`/pmcm/coordinators/${encodeURIComponent(coordinatorId)}/reliability-history`, actor), withBase(options)),
      assign: (eventId, input, actor = {}) =>
        prismRequest<PrismCoordinatorAssignment>(actorPath(event(eventId, "/coordinators"), actor), withBase(options, { method: "POST", body: input })),
      replace: (eventId, assignmentId, input, actor = {}) =>
        prismRequest<{ replacedAssignment: PrismCoordinatorAssignment; replacementAssignment: PrismCoordinatorAssignment }>(
          actorPath(event(eventId, `/coordinators/${assignmentId}/replace`), actor),
          withBase(options, { method: "POST", body: input }),
        ),
      suggestions: (eventId, input, actor = {}) => {
        const query = new URLSearchParams({ role: input.role });
        input.skills.forEach((skill) => query.append("skills", skill));
        return prismRequest<PrismCoordinatorSuggestion[]>(
          actorPath(event(eventId, `/staffing/coordinator-suggestions?${query.toString()}`), actor),
          withBase(options),
        );
      },
      poolAvailability: (eventId, actor = {}) =>
        prismRequest<PrismCoordinatorPoolAvailability>(actorPath(event(eventId, "/staffing/pool-availability"), actor), withBase(options)),
      listAvailability: (eventId, coordinatorId, actor = {}) =>
        prismRequest<PrismCoordinatorAvailability[]>(actorPath(event(eventId, `/coordinators/${coordinatorId}/availability`), actor), withBase(options)),
      createAvailability: (eventId, coordinatorId, input, actor = {}) =>
        prismRequest<PrismCoordinatorAvailability>(actorPath(event(eventId, `/coordinators/${coordinatorId}/availability`), actor), withBase(options, { method: "POST", body: input })),
      deleteAvailability: (eventId, coordinatorId, availabilityId, actor = {}) =>
        prismRequest<{ id: string }>(actorPath(event(eventId, `/coordinators/${coordinatorId}/availability/${availabilityId}`), actor), withBase(options, { method: "DELETE" })),
      replacementRecommendations: (eventId, actor = {}) =>
        prismRequest<PrismCoordinatorReplacementRecommendation[]>(actorPath(event(eventId, "/coordinator-replacements"), actor), withBase(options)),
      decideReplacement: (eventId, recommendationId, input, actor = {}) =>
        prismRequest<PrismCoordinatorReplacementRecommendation>(actorPath(event(eventId, `/coordinator-replacements/${recommendationId}/decision`), actor), withBase(options, { method: "POST", body: input })),
      sendAcknowledgementReminders: (eventId, actor = {}) =>
        prismRequest<PrismAcknowledgementReminderResult>(actorPath(event(eventId, "/staffing/acknowledgement-reminders"), actor), withBase(options, { method: "POST" })),
      upsertCoverage: (eventId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, "/staffing/coverage"), actor), withBase(options, { method: "POST", body: input })),
    },
  };
}
