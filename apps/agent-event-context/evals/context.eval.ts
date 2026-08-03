import { SAMPLE_PARE_TRIGGER } from "@prism/pare-core";
import { defineEval } from "eve/evals";

export default defineEval({
  description: "Normalizes a withdrawal through the tool rather than doing the arithmetic itself.",
  async test(t) {
    await t.send(
      `Build the PARE context for this withdrawal:\n\n${JSON.stringify(SAMPLE_PARE_TRIGGER)}`,
    );

    t.succeeded();
    t.calledTool("build_pare_event_context");
    t.messageIncludes("Ayala Summit");
    // 2026-05-07 to 2026-06-18. Getting this wrong means it guessed.
    t.messageIncludes("42");
  },
});
