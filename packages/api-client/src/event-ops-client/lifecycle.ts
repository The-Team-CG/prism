import type {
  PrismAccreditationRequirement,
  PrismApprovedClientAccount,
  PrismEventClientAccess,
  PrismEventRisk,
  PrismLogisticsBooking,
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
  SetEventCoverInput,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEventInsight,
  PrismEventWrapUp,
  PrismFloorPlanDraft,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createLifecycleClient(options: EventOpsClientOptions): Pick<EventOpsClient, "lifecycle" | "risks" | "closure" | "compliance" | "floorplans"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  return {
    lifecycle: {
      scheduleOcularVisit: (eventId, input) =>
        prismRequest<PrismPmcmOcularVisit>(event(eventId, "/ocular-visit/schedule"), withBase(options, { method: "PATCH", body: input })),
      completeOcularVisit: (eventId) =>
        prismRequest<PrismPmcmOcularVisit>(event(eventId, "/ocular-visit/complete"), withBase(options, { method: "POST" })),
      waiveOcularVisit: (eventId, input) =>
        prismRequest<PrismPmcmOcularVisit>(event(eventId, "/ocular-visit/waive"), withBase(options, { method: "POST", body: input })),
      setModules: (eventId, input) =>
        prismRequest<{ eventId: string; disabledModules: SetEventModulesInput["disabledModules"] }>(event(eventId, "/modules"), withBase(options, { method: "PATCH", body: input })),
      setPrivacy: (eventId, input) =>
        prismRequest<{ eventId: string; privacy: SetEventPrivacyInput["privacy"] }>(event(eventId, "/privacy"), withBase(options, { method: "PATCH", body: input })),
      setCover: (eventId, input) =>
        prismRequest<{ eventId: string; coverObjectId: string | null }>(event(eventId, "/cover"), withBase(options, { method: "PATCH", body: input })),
      setClientEventDayView: (eventId, input) =>
        prismRequest<PrismEvent>(event(eventId, "/client-event-day-view"), withBase(options, { method: "PATCH", body: input })),
      archive: (eventId, overrideReason) =>
        prismRequest<PrismEvent>(event(eventId, "/archive"), withBase(options, { method: "POST", body: { overrideReason } })),
      recordActualEnd: (eventId, input) =>
        prismRequest<PrismEvent>(event(eventId, "/actual-end"), withBase(options, { method: "POST", body: input })),
      startEventDay: (eventId) =>
        prismRequest<StartEventDayResult>(event(eventId, "/start-event-day"), withBase(options, { method: "POST", body: {} })),
      defenseReadiness: (eventId) =>
        prismRequest<PrismDefenseReadiness>(event(eventId, "/defense-readiness"), withBase(options)),
      eventDayStatusFeed: (eventId) =>
        prismRequest<PrismEventDayStatusFeed>(event(eventId, "/event-day/status-feed"), withBase(options)),
      cancellationSummary: (eventId) =>
        prismRequest<PrismCancellationSummary>(event(eventId, "/decisions/cancellation-summary"), withBase(options)),
      venueConfirmations: (eventId) =>
        prismRequest<PrismVenueConfirmationTask[]>(event(eventId, "/decisions/venue-confirmations"), withBase(options)),
      resolveVenueConfirmation: (eventId, taskId, input) =>
        prismRequest<PrismVenueConfirmationTask>(event(eventId, `/decisions/venue-confirmations/${taskId}/resolve`), withBase(options, { method: "POST", body: input })),
    },
    risks: {
      list: (eventId) =>
        prismRequest<PrismEventRisk[]>(event(eventId, "/risks"), withBase(options)),
      loadStandard: (eventId) =>
        prismRequest<PrismEventRisk[]>(event(eventId, "/risks/standard"), withBase(options, { method: "POST" })),
      create: (eventId, input) =>
        prismRequest<PrismEventRisk>(event(eventId, "/risks"), withBase(options, { method: "POST", body: input })),
      update: (eventId, riskId, input) =>
        prismRequest<PrismEventRisk>(event(eventId, `/risks/${riskId}`), withBase(options, { method: "PATCH", body: input })),
    },
    closure: {
      closeGates: (eventId) =>
        prismRequest<PrismCloseGates>(event(eventId, "/close-gates"), withBase(options)),
      insights: (eventId) =>
        prismRequest<PrismEventInsight[]>(event(eventId, "/insights"), withBase(options)),
      generateInsights: (eventId) =>
        prismRequest<PrismEventInsight>(event(eventId, "/insights/generate"), withBase(options, { method: "POST" })),
      wrapUp: (eventId) =>
        prismRequest<PrismEventWrapUp | null>(event(eventId, "/wrap-up"), withBase(options)),
      startWrapUp: (eventId, input) =>
        prismRequest<PrismEventWrapUp>(event(eventId, "/wrap-up"), withBase(options, { method: "POST", body: input })),
      updateWrapUp: (eventId, input) =>
        prismRequest<PrismEventWrapUp>(event(eventId, "/wrap-up"), withBase(options, { method: "PATCH", body: input })),
      logisticsBookings: (eventId) =>
        prismRequest<PrismLogisticsBooking[]>(event(eventId, "/logistics-bookings"), withBase(options)),
      createLogisticsBooking: (eventId, input) =>
        prismRequest<PrismLogisticsBooking>(event(eventId, "/logistics-bookings"), withBase(options, { method: "POST", body: input })),
      compareArchived: (eventIds) =>
        prismRequest<PrismArchiveComparisonRow[]>(`/events/archive/compare?eventIds=${encodeURIComponent(eventIds.join(","))}`, withBase(options)),
      completePostEventDocument: (eventId, documentId) =>
        prismRequest<PrismPostEventDocument>(`/events/${encodeURIComponent(eventId)}/post-event-documents/${encodeURIComponent(documentId)}/complete`, withBase(options, { method: "PATCH" })),
      logisticsCompletion: (eventId) =>
        prismRequest<PrismLogisticsCompletion | null>(event(eventId, "/logistics-completion"), withBase(options)),
      recordLogisticsCompletion: (eventId, input) =>
        prismRequest<PrismLogisticsCompletion>(event(eventId, "/logistics-completion"), withBase(options, { method: "POST", body: input })),
      clientCloseoutModeration: (eventId) =>
        prismRequest<(PrismClientCloseoutResponse & { actorEmail?: string | null }) | null>(event(eventId, "/client-closeout/moderation"), withBase(options)),
      moderateClientCloseout: (eventId, input) =>
        prismRequest<PrismClientCloseoutResponse>(event(eventId, "/client-closeout/moderation"), withBase(options, { method: "PATCH", body: input })),
    },
    compliance: {
      listRules: () => prismRequest<PrismComplianceRule[]>("/compliance/rules", withBase(options)),
      createRule: (input) =>
        prismRequest<PrismComplianceRule>("/compliance/rules", withBase(options, { method: "POST", body: input })),
      updateRule: (ruleId, input) =>
        prismRequest<PrismComplianceRule>(`/compliance/rules/${encodeURIComponent(ruleId)}`, withBase(options, { method: "PATCH", body: input })),
      resolve: (eventId, checkId, input) =>
        prismRequest<PrismComplianceCheck>(event(eventId, `/compliance/${checkId}`), withBase(options, { method: "PATCH", body: input })),
      run: (eventId, input) =>
        prismRequest<PrismComplianceCheck[]>(event(eventId, "/compliance"), withBase(options, { method: "POST", body: input })),
      runs: (eventId) =>
        prismRequest<PrismComplianceRun[]>(event(eventId, "/compliance/runs"), withBase(options)),
      risks: (eventId) =>
        prismRequest<PrismComplianceRisk[]>(event(eventId, "/compliance/risks"), withBase(options)),
      accreditationRequirements: (eventId) =>
        prismRequest<PrismAccreditationRequirement[]>(event(eventId, "/accreditation"), withBase(options)),
      createAccreditationRequirement: (eventId, input) =>
        prismRequest<PrismAccreditationRequirement>(event(eventId, "/accreditation"), withBase(options, { method: "POST", body: input })),
      updateAccreditationRequirement: (eventId, requirementId, input) =>
        prismRequest<PrismAccreditationRequirement>(event(eventId, `/accreditation/${requirementId}`), withBase(options, { method: "PATCH", body: input })),
      createRisk: (eventId, input) =>
        prismRequest<PrismComplianceRisk>(event(eventId, "/compliance/risks"), withBase(options, { method: "POST", body: input })),
      updateRisk: (eventId, riskId, input) =>
        prismRequest<PrismComplianceRisk>(event(eventId, `/compliance/risks/${encodeURIComponent(riskId)}`), withBase(options, { method: "PATCH", body: input })),
    },
    floorplans: {
      createDraft: (eventId, input) =>
        prismRequest<PrismFloorPlanDraft>(event(eventId, "/floorplans"), withBase(options, { method: "POST", body: input })),
      submitDraft: (eventId, draftId) =>
        prismRequest<PrismFloorPlanDraft>(event(eventId, `/floorplans/${draftId}/submit`), withBase(options, { method: "POST" })),
      approveDraft: (eventId, draftId) =>
        prismRequest<PrismFloorPlanDraft>(event(eventId, `/floorplans/${draftId}/approve`), withBase(options, { method: "POST" })),
      reopenPreference: (eventId, draftId) =>
        prismRequest<PrismFloorPlanDraft>(event(eventId, `/floorplans/${draftId}/reopen-preference`), withBase(options, { method: "POST" })),
      clientAccess: (eventId) =>
        prismRequest<PrismEventClientAccess>(`/events/${encodeURIComponent(eventId)}/client-floorplan-access`, withBase(options)),
      searchClientCandidates: (eventId, query) =>
        prismRequest<PrismApprovedClientAccount[]>(`/events/${encodeURIComponent(eventId)}/client-floorplan-access/candidates?${new URLSearchParams({ query }).toString()}`, withBase(options)),
      grantClientAccess: (eventId, userId) =>
        prismRequest<PrismEventClientAccess>(`/events/${encodeURIComponent(eventId)}/client-floorplan-access`, withBase(options, { method: "POST", body: { userId } })),
      revokeClientAccess: (eventId, userId) =>
        prismRequest<PrismEventClientAccess>(`/events/${encodeURIComponent(eventId)}/client-floorplan-access/${encodeURIComponent(userId)}`, withBase(options, { method: "DELETE" })),
      history: (eventId, draftId) =>
        prismRequest<PrismFloorPlanSnapshotVersion[]>(`/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/history`, withBase(options)),
      plan: <TPlan = unknown>(planId: string) =>
        prismRequest<TPlan>(`/plans/${planId}`, withBase(options)),
      savePlan: <TPlan = unknown>(planId: string, body: unknown) =>
        prismRequest<TPlan>(`/plans/${planId}`, withBase(options, { method: "PUT", body })),
    },
  };
}
