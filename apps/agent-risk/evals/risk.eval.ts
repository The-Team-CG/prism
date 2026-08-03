import { SAMPLE_PARE_TRIGGER, buildPareEventContext } from "@prism/pare-core";
import { defineEval } from "eve/evals";

const context = buildPareEventContext(SAMPLE_PARE_TRIGGER);

export default defineEval({
  description: "Calls an empty shortlist days before the event HIGH risk and escalates.",
  async test(t) {
    await t.send(
      `Assess replacement risk:\n\n${JSON.stringify({
        context: { ...context, daysUntilEvent: 3, candidates: [] },
      })}`,
    );

    t.succeeded();
    t.calledTool("compute_risk_baseline");
    t.messageIncludes("HIGH");
    t.messageIncludes(/escalat/i);
  },
});
