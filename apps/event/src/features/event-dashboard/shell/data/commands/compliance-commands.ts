import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import {
  createComplianceRuleSchema,
  parseContract,
  resolveComplianceSchema,
  runComplianceSchema,
  type CreateComplianceRuleInput,
  type PrismComplianceCheck,
  type PrismComplianceRule,
  type ResolveComplianceInput,
} from "@prism/types";

export const complianceCommands = {
  createComplianceRule: (input: CreateComplianceRuleInput) =>
    request<PrismComplianceRule>("/api/compliance/rules", {
      method: "POST",
      body: parseContract(createComplianceRuleSchema, input, "Compliance rule"),
    }),
  resolveCompliance: (
    eventId: string,
    checkId: string,
    input: ResolveComplianceInput = { note: "Resolved during PMCM review." },
  ) =>
    request<PrismComplianceCheck>(`/api/events/${eventId}/compliance/${checkId}`, {
      method: "PATCH",
      body: parseContract(resolveComplianceSchema, input, "Compliance decision"),
    }),
  runCompliance: (eventId: string, phase = "planning") =>
    request<PrismComplianceCheck[]>(`/api/events/${eventId}/compliance`, {
      method: "POST",
      body: parseContract(runComplianceSchema, { phase }, "Compliance run"),
    }),
};
