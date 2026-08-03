import { analyzePareBudget } from "@prism/pare-core";
import { pareBudgetAnalysisSchema, pareCandidateSchema, pareContextSchema } from "@prism/types";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Compute the budget arithmetic for a replacement candidate: cost delta against the " +
    "withdrawn supplier's quote, whether it fits the remaining budget, and a plain-language " +
    "summary. This is P.R.I.S.M's own calculation — use it as the basis for your verdict " +
    "rather than doing the arithmetic yourself.",
  inputSchema: z.object({
    context: pareContextSchema,
    candidate: pareCandidateSchema.describe("The replacement being priced, normally the top of the shortlist."),
  }),
  outputSchema: pareBudgetAnalysisSchema,
  execute({ context, candidate }) {
    return analyzePareBudget(context, candidate);
  },
});
