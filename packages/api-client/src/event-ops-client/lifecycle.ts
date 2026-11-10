import type {
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

export function createLifecycleClient(options: EventOpsClientOptions): Pick<EventOpsClient, "closure" | "compliance" | "floorplans"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  return {
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
    },
    compliance: {
      createRule: (input, actor = {}) =>
        prismRequest<PrismComplianceRule>(actorPath("/compliance/rules", actor), withBase(options, { method: "POST", body: input })),
      resolve: (eventId, checkId, input, actor = {}) =>
        prismRequest<PrismComplianceCheck>(actorPath(event(eventId, `/compliance/${checkId}`), actor), withBase(options, { method: "PATCH", body: input })),
      run: (eventId, input, actor = {}) =>
        prismRequest<PrismComplianceCheck[]>(actorPath(event(eventId, "/compliance"), actor), withBase(options, { method: "POST", body: input })),
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
      plan: <TPlan = unknown>(planId: string, actor = {}) =>
        prismRequest<TPlan>(actorPath(`/plans/${planId}`, actor), withBase(options)),
      savePlan: <TPlan = unknown>(planId: string, body: unknown, actor = {}) =>
        prismRequest<TPlan>(actorPath(`/plans/${planId}`, actor), withBase(options, { method: "PUT", body })),
    },
  };
}
