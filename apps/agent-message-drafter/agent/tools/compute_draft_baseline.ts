import { draftPareMessages } from "@prism/pare-core";
import { pareContextSchema, pareDraftsSchema } from "@prism/types";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Return PMCM's house drafts for both messages — the supplier assignment offer and the " +
    "client update — filled in with the event, category, date and selected replacement from " +
    "the context. Use them as the basis for your drafts. Sends nothing.",
  inputSchema: z.object({
    context: pareContextSchema.describe(
      "The PARE context, including the budget verdict that names the selected replacement.",
    ),
  }),
  outputSchema: pareDraftsSchema,
  execute({ context }) {
    return draftPareMessages(context);
  },
});
