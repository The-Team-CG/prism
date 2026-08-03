import {
  SAMPLE_PARE_SUPPLIERS,
  SAMPLE_PARE_TRIGGER,
  buildPareEventContext,
} from "@prism/pare-core";
import { defineEval } from "eve/evals";

const context = buildPareEventContext(SAMPLE_PARE_TRIGGER);

export default defineEval({
  description: "Shortlists through the ranking tool instead of picking a supplier itself.",
  async test(t) {
    await t.send(
      `Shortlist replacements for this withdrawal:\n\n${JSON.stringify({
        context,
        suppliers: SAMPLE_PARE_SUPPLIERS,
      })}`,
    );

    t.succeeded();
    t.calledTool("rank_supplier_candidates");
    t.messageIncludes("AV Backup Crew");
  },
});
