import { assessPareRisk } from "@prism/pare-core";
import { pareContextSchema, pareRiskSchema } from "@prism/types";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Score the operational risk of the shortlisted replacement using P.R.I.S.M's own model: " +
    "timeline pressure, replacement tier, pricing confidence, first-time bookings and unmet " +
    "client requirements. Returns a level, the factors found and a recommendation. Use it as " +
    "the basis for your assessment rather than scoring by feel.",
  inputSchema: z.object({
    context: pareContextSchema.describe(
      "The PARE context, including the ranked candidates and any budget verdict already reached.",
    ),
  }),
  outputSchema: pareRiskSchema,
  execute({ context }) {
    return assessPareRisk(context);
  },
});
