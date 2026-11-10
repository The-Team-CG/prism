import type { CreateEventRiskInput, UpdateEventRiskInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const riskRegisterRepository = {
  list: (eventId: string) => eventApi.risks.list(eventId),
  loadStandard: (eventId: string) => eventApi.risks.loadStandard(eventId),
  create: (eventId: string, input: CreateEventRiskInput) => eventApi.risks.create(eventId, input),
  update: (eventId: string, riskId: string, input: UpdateEventRiskInput) => eventApi.risks.update(eventId, riskId, input),
};
