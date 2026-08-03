import { buildPareEventContext } from "@prism/pare-core";
import { pareContextSchema, pareTriggerInputSchema } from "@prism/types";
import { defineTool } from "eve/tools";

export default defineTool({
  description:
    "Normalize the raw facts of a supplier withdrawal into the PARE event context. " +
    "Computes days until the event, spend to date from selected quotes, the withdrawn " +
    "supplier's quoted amount, and the client's stated preferences.",
  inputSchema: pareTriggerInputSchema,
  outputSchema: pareContextSchema,
  execute(input) {
    return buildPareEventContext(input);
  },
});
