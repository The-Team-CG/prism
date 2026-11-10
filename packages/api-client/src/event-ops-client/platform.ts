import type {
  ComplianceAdvisoryResult,
  EventIntelligenceResult,
  OperationsAssistantResult,
  PAREApprovalRecord,
  PrismCanvaConnection,
  PrismCanvaDesign,
  PrismEventDayCopilot,
  PrismSupplierReliabilityScore,
  ThemeSuggestionResult,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createPlatformClient(options: EventOpsClientOptions): Pick<EventOpsClient, "advisory" | "canva" | "pare"> {
  return {
    advisory: {
      compliance: (input, actor = {}) =>
        prismRequest<ComplianceAdvisoryResult>(actorPath("/ai-advisory/compliance", actor), withBase(options, { method: "POST", body: input })),
      themes: (input, actor = {}) =>
        prismRequest<ThemeSuggestionResult>(actorPath("/ai-advisory/themes", actor), withBase(options, { method: "POST", body: input })),
      eventIntelligence: (input, actor = {}) =>
        prismRequest<EventIntelligenceResult>(actorPath("/ai-advisory/event-intelligence", actor), withBase(options, { method: "POST", body: input })),
      eventDayCopilot: (input, actor = {}) =>
        prismRequest<PrismEventDayCopilot>(actorPath("/ai-advisory/event-day-copilot", actor), withBase(options, { method: "POST", body: input })),
      askAssistant: (eventId, input, actor = {}) =>
        prismRequest<OperationsAssistantResult>(actorPath(`/ai-advisory/events/${encodeURIComponent(eventId)}/assistant`, actor), withBase(options, { method: "POST", body: input })),
      supplierReliabilityScore: (supplierId, actor = {}) =>
        prismRequest<PrismSupplierReliabilityScore>(actorPath(`/suppliers/${encodeURIComponent(supplierId)}/reliability-score`, actor), withBase(options)),
    },
    canva: {
      status: (actor = {}) => prismRequest<PrismCanvaConnection>(actorPath("/integrations/canva", actor), withBase(options)),
      authorize: (actor = {}) => prismRequest<{ url: string }>(actorPath("/integrations/canva/authorize", actor), withBase(options, { method: "POST" })),
      disconnect: (actor = {}) => prismRequest<PrismCanvaConnection>(actorPath("/integrations/canva", actor), withBase(options, { method: "DELETE" })),
      proposalDesign: (eventId, actor = {}) =>
        prismRequest<PrismCanvaDesign>(actorPath(`/events/${encodeURIComponent(eventId)}/proposal/canva`, actor), withBase(options, { method: "POST" })),
      testimonialDesign: (eventId, actor = {}) =>
        prismRequest<PrismCanvaDesign>(actorPath(`/events/${encodeURIComponent(eventId)}/client-closeout/testimonial/canva`, actor), withBase(options, { method: "POST" })),
    },
    pare: {
      pending: (actor = {}) => prismRequest<PAREApprovalRecord[]>(actorPath("/ai/pare/pending", actor), withBase(options)),
      approve: (approvalRecordId, actor = {}) =>
        prismRequest<PAREApprovalRecord>(actorPath(`/ai/pare/${approvalRecordId}/approve`, actor), withBase(options, { method: "PATCH" })),
      reject: (approvalRecordId, actor = {}) =>
        prismRequest<PAREApprovalRecord>(actorPath(`/ai/pare/${approvalRecordId}/reject`, actor), withBase(options, { method: "PATCH" })),
    },
  };
}
