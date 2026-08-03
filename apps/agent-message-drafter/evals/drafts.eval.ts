import {
  SAMPLE_PARE_SUPPLIERS,
  SAMPLE_PARE_TRIGGER,
  analyzePareBudget,
  buildPareEventContext,
  rankSupplierCandidates,
} from "@prism/pare-core";
import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

const base = buildPareEventContext(SAMPLE_PARE_TRIGGER);
const candidates = rankSupplierCandidates(base, SAMPLE_PARE_SUPPLIERS);
const context = {
  ...base,
  candidates,
  budgetAnalysis: analyzePareBudget(base, candidates[0]!),
};

export default defineEval({
  description: "Names the replacement and the client without blaming the withdrawn supplier.",
  async test(t) {
    await t.send(`Draft both messages:\n\n${JSON.stringify({ context })}`);

    t.succeeded();
    t.calledTool("compute_draft_baseline");
    t.messageIncludes("AV Backup Crew");
    t.messageIncludes("Ana Reyes");
    t.check(
      t.reply,
      satisfies<string | null>(
        (reply) => !/unfortunate/i.test(reply ?? ""),
        'avoids the word "unfortunate"',
      ),
    );
  },
});
