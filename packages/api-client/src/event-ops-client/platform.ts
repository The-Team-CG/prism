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
import { withBase } from "./shared";

export function createPlatformClient(options: EventOpsClientOptions): Pick<EventOpsClient, "advisory" | "canva" | "pare"> {
  return {
    advisory: {
      compliance: (input) =>
        prismRequest<ComplianceAdvisoryResult>("/ai-advisory/compliance", withBase(options, { method: "POST", body: input })),
      themes: (input) =>
        prismRequest<ThemeSuggestionResult>("/ai-advisory/themes", withBase(options, { method: "POST", body: input })),
      eventIntelligence: (input) =>
        prismRequest<EventIntelligenceResult>("/ai-advisory/event-intelligence", withBase(options, { method: "POST", body: input })),
      eventDayCopilot: (input) =>
        prismRequest<PrismEventDayCopilot>("/ai-advisory/event-day-copilot", withBase(options, { method: "POST", body: input })),
      askAssistant: (eventId, input) =>
        prismRequest<OperationsAssistantResult>(`/ai-advisory/events/${encodeURIComponent(eventId)}/assistant`, withBase(options, { method: "POST", body: input })),
      supplierReliabilityScore: (supplierId) =>
        prismRequest<PrismSupplierReliabilityScore>(`/suppliers/${encodeURIComponent(supplierId)}/reliability-score`, withBase(options)),
    },
    canva: {
      status: () => prismRequest<PrismCanvaConnection>("/integrations/canva", withBase(options)),
      authorize: () => prismRequest<{ url: string }>("/integrations/canva/authorize", withBase(options, { method: "POST" })),
      disconnect: () => prismRequest<PrismCanvaConnection>("/integrations/canva", withBase(options, { method: "DELETE" })),
      proposalDesign: (eventId) =>
        prismRequest<PrismCanvaDesign>(`/events/${encodeURIComponent(eventId)}/proposal/canva`, withBase(options, { method: "POST" })),
      testimonialDesign: (eventId) =>
        prismRequest<PrismCanvaDesign>(`/events/${encodeURIComponent(eventId)}/client-closeout/testimonial/canva`, withBase(options, { method: "POST" })),
    },
    pare: {
      pending: () => prismRequest<PAREApprovalRecord[]>("/ai/pare/pending", withBase(options)),
      approve: (approvalRecordId) =>
        prismRequest<PAREApprovalRecord>(`/ai/pare/${approvalRecordId}/approve`, withBase(options, { method: "PATCH" })),
      reject: (approvalRecordId) =>
        prismRequest<PAREApprovalRecord>(`/ai/pare/${approvalRecordId}/reject`, withBase(options, { method: "PATCH" })),
    },
  };
}
