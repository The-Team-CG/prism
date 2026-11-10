import { aiEventRequestSchema, askOperationsAssistantSchema, parseContract } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

const body = (eventId: string) => parseContract(aiEventRequestSchema, { eventId }, "AI request");

export const aiAdvisoryRepository = {
  compliance: (eventId: string) => eventApi.advisory.compliance(body(eventId)),
  themes: (eventId: string) => eventApi.advisory.themes(body(eventId)),
  intelligence: (eventId: string) => eventApi.advisory.eventIntelligence(body(eventId)),
  eventDayCopilot: (eventId: string) => eventApi.advisory.eventDayCopilot(body(eventId)),
  askAssistant: (eventId: string, question: string, history: Array<{ question: string; answer: string }>) =>
    eventApi.advisory.askAssistant(eventId, parseContract(askOperationsAssistantSchema, { question, history }, "Question")),
  reliabilityScore: (supplierId: string) => eventApi.advisory.supplierReliabilityScore(supplierId),
};
