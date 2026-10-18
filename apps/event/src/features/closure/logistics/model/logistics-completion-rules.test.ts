import { describe, expect, it } from "vitest";
import { buildLogisticsCompletionInput, type LogisticsCompletionDraft } from "./logistics-completion-rules";

const draft: LogisticsCompletionDraft = {
  assetReturnsVerified: true,
  completionSummary: "  Staging and AV returned  ",
  privateNotes: "Forklift damage queried with supplier",
  correctionReason: "",
};

describe("buildLogisticsCompletionInput", () => {
  it("refuses to record completion until asset returns are confirmed", () => {
    expect(buildLogisticsCompletionInput({ ...draft, assetReturnsVerified: false }, false)).toEqual({
      ok: false,
      message: "Confirm asset returns before recording logistics completion.",
    });
  });

  it("requires a correction reason before replacing an existing record, and drops it for a first record", () => {
    expect(buildLogisticsCompletionInput(draft, true).ok).toBe(false);
    const first = buildLogisticsCompletionInput({ ...draft, correctionReason: "stale reason" }, false);
    expect(first).toEqual({
      ok: true,
      input: { assetReturnsVerified: true, completionSummary: "Staging and AV returned", privateNotes: "Forklift damage queried with supplier" },
    });
    const correction = buildLogisticsCompletionInput({ ...draft, correctionReason: "Late crate return" }, true);
    expect(correction).toMatchObject({ ok: true, input: { correctionReason: "Late crate return" } });
  });

  it("rejects a blank completion summary", () => {
    expect(buildLogisticsCompletionInput({ ...draft, completionSummary: "   " }, false).ok).toBe(false);
  });
});
