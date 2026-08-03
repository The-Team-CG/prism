import {
  SAMPLE_PARE_SUPPLIERS,
  SAMPLE_PARE_TRIGGER,
  buildPareEventContext,
  rankSupplierCandidates,
} from "@prism/pare-core";
import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

const base = buildPareEventContext(SAMPLE_PARE_TRIGGER);
const candidates = rankSupplierCandidates(base, SAMPLE_PARE_SUPPLIERS);

export default defineEval({
  description: "Treats a candidate with no quote on file as needing a quote, not as free.",
  async test(t) {
    await t.send(
      `Assess budget feasibility:\n\n${JSON.stringify({
        context: { ...base, candidates },
        candidate: candidates[0],
      })}`,
    );

    t.succeeded();
    t.calledTool("compute_budget_baseline");
    // quotedAmount is 0, which means "PMCM has not asked them for a price yet".
    t.messageIncludes("quote");
    t.check(
      t.reply,
      satisfies<string | null>(
        (reply) => !/\b(free|no cost|zero cost|at no charge)\b/i.test(reply ?? ""),
        "does not present a missing quote as a free supplier",
      ),
    );
  },
});
