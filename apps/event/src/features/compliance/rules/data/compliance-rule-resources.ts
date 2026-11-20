import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** Every compliance rule the checks run, built-in ones included, for Settings → Event rules. */
export const complianceRuleCatalog = defineResource({
  name: "compliance.rule-catalog",
  staleMs: 5 * 60_000,
  fetch: (_actor: "signed-in") => eventApi.compliance.listRules(),
});
