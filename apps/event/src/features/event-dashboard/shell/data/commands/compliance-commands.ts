import { eventApi as eventOpsClient } from "@/lib/prism-api";
import {
  createComplianceRuleSchema,
  updateComplianceRuleSchema,
  parseContract,
  resolveComplianceSchema,
  runComplianceSchema,
  type CreateComplianceRuleInput,
  type UpdateComplianceRuleInput,
  type ResolveComplianceInput,
} from "@prism/types";

export const complianceCommands = {
createComplianceRule: (input: CreateComplianceRuleInput) =>
    eventOpsClient.compliance.createRule(parseContract(createComplianceRuleSchema, input, "Compliance rule")),
updateComplianceRule: (ruleId: string, input: UpdateComplianceRuleInput) =>
    eventOpsClient.compliance.updateRule(ruleId, parseContract(updateComplianceRuleSchema, input, "Compliance rule")),
resolveCompliance: (
    eventId: string,
    checkId: string,
    input: ResolveComplianceInput = { note: "Resolved during PMCM review." },
  ) =>
    eventOpsClient.compliance.resolve(eventId, checkId, parseContract(resolveComplianceSchema, input, "Compliance decision")),
runCompliance: (eventId: string, phase = "planning") =>
    eventOpsClient.compliance.run(eventId, parseContract(runComplianceSchema, { phase }, "Compliance run")),
};
