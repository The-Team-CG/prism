import { aiEventRequestSchema, parseContract, type ComplianceAdvisoryResult, type EventIntelligenceResult, type PrismSupplierReliabilityScore, type ThemeSuggestionResult } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const body = (eventId: string) => parseContract(aiEventRequestSchema, { eventId }, "AI request");

export const aiAdvisoryRepository = {
  compliance: (eventId: string) => eventApiRequest<ComplianceAdvisoryResult>("/api/ai-advisory/compliance", { method: "POST", body: body(eventId) }),
  themes: (eventId: string) => eventApiRequest<ThemeSuggestionResult>("/api/ai-advisory/themes", { method: "POST", body: body(eventId) }),
  intelligence: (eventId: string) => eventApiRequest<EventIntelligenceResult>("/api/ai-advisory/event-intelligence", { method: "POST", body: body(eventId) }),
  reliabilityScore: (supplierId: string) => eventApiRequest<PrismSupplierReliabilityScore>(`/api/suppliers/${encodeURIComponent(supplierId)}/reliability-score`),
};
