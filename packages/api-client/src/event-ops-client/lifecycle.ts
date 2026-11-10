import type {
  StartEventDayResult,
  PrismArchiveComparisonRow,
  PrismCancellationSummary,
  PrismClientCloseoutResponse,
  PrismComplianceRisk,
  PrismComplianceRun,
  PrismDefenseReadiness,
  PrismEventDayStatusFeed,
  PrismFloorPlanSnapshotVersion,
  PrismLogisticsCompletion,
  PrismPostEventDocument,
  PrismVenueConfirmationTask,
  PrismEvent,
  PrismPmcmOcularVisit,
  SetEventModulesInput,
  SetEventPrivacyInput,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEventInsight,
  PrismEventWrapUp,
  PrismFloorPlanDraft,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createLifecycleClient(options: EventOpsClientOptions): Pick<EventOpsClient, "lifecycle" | "closure" | "compliance" | "floorplans"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  return {
    lifecycle: {
      scheduleOcularVisit: (eventId, input, actor = {}) =>
        prismRequest<PrismPmcmOcularVisit>(actorPath(event(eventId, "/ocular-visit/schedule"), actor), withBase(options, { method: "PATCH", body: input })),
      completeOcularVisit: (eventId, actor = {}) =>
        prismRequest<PrismPmcmOcularVisit>(actorPath(event(eventId, "/ocular-visit/complete"), actor), withBase(options, { method: "POST" })),
      waiveOcularVisit: (eventId, input, actor = {}) =>
        prismRequest<PrismPmcmOcularVisit>(actorPath(event(eventId, "/ocular-visit/waive"), actor), withBase(options, { method: "POST", body: input })),
      setModules: (eventId, input, actor = {}) =>
        prismRequest<{ eventId: string; disabledModules: SetEventModulesInput["disabledModules"] }>(actorPath(event(eventId, "/modules"), actor), withBase(options, { method: "PATCH", body: input })),
      setPrivacy: (eventId, input, actor = {}) =>
        prismRequest<{ eventId: string; privacy: SetEventPrivacyInput["privacy"] }>(actorPath(event(eventId, "/privacy"), actor), withBase(options, { method: "PATCH", body: input })),
      setClientEventDayView: (eventId, input, actor = {}) =>
        prismRequest<PrismEvent>(actorPath(event(eventId, "/client-event-day-view"), actor), withBase(options, { method: "PATCH", body: input })),
      archive: (eventId, overrideReason, actor = {}) =>
        prismRequest<PrismEvent>(actorPath(event(eventId, "/archive"), actor), withBase(options, { method: "POST", body: { overrideReason } })),
      recordActualEnd: (eventId, input, actor = {}) =>
        prismRequest<PrismEvent>(actorPath(event(eventId, "/actual-end"), actor), withBase(options, { method: "POST", body: input })),
      startEventDay: (eventId, actor = {}) =>
        prismRequest<StartEventDayResult>(actorPath(event(eventId, "/start-event-day"), actor), withBase(options, { method: "POST", body: {} })),
      defenseReadiness: (eventId, actor = {}) =>
        prismRequest<PrismDefenseReadiness>(actorPath(event(eventId, "/defense-readiness"), actor), withBase(options)),
      eventDayStatusFeed: (eventId, actor = {}) =>
        prismRequest<PrismEventDayStatusFeed>(actorPath(event(eventId, "/event-day/status-feed"), actor), withBase(options)),
      cancellationSummary: (eventId, actor = {}) =>
        prismRequest<PrismCancellationSummary>(actorPath(event(eventId, "/decisions/cancellation-summary"), actor), withBase(options)),
      venueConfirmations: (eventId, actor = {}) =>
        prismRequest<PrismVenueConfirmationTask[]>(actorPath(event(eventId, "/decisions/venue-confirmations"), actor), withBase(options)),
      resolveVenueConfirmation: (eventId, taskId, input, actor = {}) =>
        prismRequest<PrismVenueConfirmationTask>(actorPath(event(eventId, `/decisions/venue-confirmations/${taskId}/resolve`), actor), withBase(options, { method: "POST", body: input })),
    },
    closure: {
      closeGates: (eventId, actor = {}) =>
        prismRequest<PrismCloseGates>(actorPath(event(eventId, "/close-gates"), actor), withBase(options)),
      insights: (eventId, actor = {}) =>
        prismRequest<PrismEventInsight[]>(actorPath(event(eventId, "/insights"), actor), withBase(options)),
      generateInsights: (eventId, actor = {}) =>
        prismRequest<PrismEventInsight>(actorPath(event(eventId, "/insights/generate"), actor), withBase(options, { method: "POST" })),
      wrapUp: (eventId, actor = {}) =>
        prismRequest<PrismEventWrapUp | null>(actorPath(event(eventId, "/wrap-up"), actor), withBase(options)),
      startWrapUp: (eventId, input, actor = {}) =>
        prismRequest<PrismEventWrapUp>(actorPath(event(eventId, "/wrap-up"), actor), withBase(options, { method: "POST", body: input })),
      updateWrapUp: (eventId, input, actor = {}) =>
        prismRequest<PrismEventWrapUp>(actorPath(event(eventId, "/wrap-up"), actor), withBase(options, { method: "PATCH", body: input })),
      compareArchived: (eventIds, actor = {}) =>
        prismRequest<PrismArchiveComparisonRow[]>(actorPath(`/events/archive/compare?eventIds=${encodeURIComponent(eventIds.join(","))}`, actor), withBase(options)),
      completePostEventDocument: (eventId, documentId, actor = {}) =>
        prismRequest<PrismPostEventDocument>(actorPath(`/events/${encodeURIComponent(eventId)}/post-event-documents/${encodeURIComponent(documentId)}/complete`, actor), withBase(options, { method: "PATCH" })),
      logisticsCompletion: (eventId, actor = {}) =>
        prismRequest<PrismLogisticsCompletion | null>(actorPath(event(eventId, "/logistics-completion"), actor), withBase(options)),
      recordLogisticsCompletion: (eventId, input, actor = {}) =>
        prismRequest<PrismLogisticsCompletion>(actorPath(event(eventId, "/logistics-completion"), actor), withBase(options, { method: "POST", body: input })),
      clientCloseoutModeration: (eventId, actor = {}) =>
        prismRequest<(PrismClientCloseoutResponse & { actorEmail?: string | null }) | null>(actorPath(event(eventId, "/client-closeout/moderation"), actor), withBase(options)),
      moderateClientCloseout: (eventId, input, actor = {}) =>
        prismRequest<PrismClientCloseoutResponse>(actorPath(event(eventId, "/client-closeout/moderation"), actor), withBase(options, { method: "PATCH", body: input })),
    },
    compliance: {
      createRule: (input, actor = {}) =>
        prismRequest<PrismComplianceRule>(actorPath("/compliance/rules", actor), withBase(options, { method: "POST", body: input })),
      resolve: (eventId, checkId, input, actor = {}) =>
        prismRequest<PrismComplianceCheck>(actorPath(event(eventId, `/compliance/${checkId}`), actor), withBase(options, { method: "PATCH", body: input })),
      run: (eventId, input, actor = {}) =>
        prismRequest<PrismComplianceCheck[]>(actorPath(event(eventId, "/compliance"), actor), withBase(options, { method: "POST", body: input })),
      runs: (eventId, actor = {}) =>
        prismRequest<PrismComplianceRun[]>(actorPath(event(eventId, "/compliance/runs"), actor), withBase(options)),
      risks: (eventId, actor = {}) =>
        prismRequest<PrismComplianceRisk[]>(actorPath(event(eventId, "/compliance/risks"), actor), withBase(options)),
      createRisk: (eventId, input, actor = {}) =>
        prismRequest<PrismComplianceRisk>(actorPath(event(eventId, "/compliance/risks"), actor), withBase(options, { method: "POST", body: input })),
    },
    floorplans: {
      createDraft: (eventId, input, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(actorPath(event(eventId, "/floorplans"), actor), withBase(options, { method: "POST", body: input })),
      submitDraft: (eventId, draftId, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(actorPath(event(eventId, `/floorplans/${draftId}/submit`), actor), withBase(options, { method: "POST" })),
      approveDraft: (eventId, draftId, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(actorPath(event(eventId, `/floorplans/${draftId}/approve`), actor), withBase(options, { method: "POST" })),
      reopenPreference: (eventId, draftId, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(actorPath(event(eventId, `/floorplans/${draftId}/reopen-preference`), actor), withBase(options, { method: "POST" })),
      history: (eventId, draftId, actor = {}) =>
        prismRequest<PrismFloorPlanSnapshotVersion[]>(actorPath(`/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/history`, actor), withBase(options)),
      plan: <TPlan = unknown>(planId: string, actor = {}) =>
        prismRequest<TPlan>(actorPath(`/plans/${planId}`, actor), withBase(options)),
      savePlan: <TPlan = unknown>(planId: string, body: unknown, actor = {}) =>
        prismRequest<TPlan>(actorPath(`/plans/${planId}`, actor), withBase(options, { method: "PUT", body })),
    },
  };
}
