import { rankSupplierCandidates } from "@prism/pare-core";
import { pareCandidateSchema, pareContextSchema, pareSupplierRecordSchema } from "@prism/types";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Rank replacement candidates for the withdrawn supplier's category. Filters out the " +
    "withdrawn supplier, anyone already confirmed on the event and duplicate names, scores " +
    "reliability from review history, detects halal certification, then orders by tier and " +
    "reliability and returns at most five candidates.",
  inputSchema: z.object({
    context: pareContextSchema,
    suppliers: z
      .array(pareSupplierRecordSchema)
      .describe("Candidate supplier rows, including their reviews, quotes and quote requests."),
  }),
  outputSchema: z.array(pareCandidateSchema),
  execute({ context, suppliers }) {
    return rankSupplierCandidates(context, suppliers);
  },
});
