import { describe, expect, it } from "vitest";
import { guestPassSampleReducer, initialGuestPassSample, SAMPLE_ACCESS_CODE, type GuestPassSampleAction } from "./guest-pass-sample";

const run = (actions: GuestPassSampleAction[]) => actions.reduce(guestPassSampleReducer, initialGuestPassSample);

describe("guest pass promotional sample", () => {
  it("walks a prospect from the code to sent feedback", () => {
    const state = run([
      { type: "type_code", code: SAMPLE_ACCESS_CODE.toLowerCase() },
      { type: "open_pass" },
      { type: "check_in" },
      { type: "rate", rating: 5 },
      { type: "send_feedback" },
    ]);
    expect(state).toMatchObject({ step: "feedback_sent", rating: 5, error: null });
  });

  it("only opens with the sample code and needs a rating before feedback", () => {
    expect(run([{ type: "type_code", code: "REAL-EVENT" }, { type: "open_pass" }])).toMatchObject({ step: "code", error: expect.stringContaining(SAMPLE_ACCESS_CODE) });
    expect(run([{ type: "type_code", code: SAMPLE_ACCESS_CODE }, { type: "open_pass" }, { type: "check_in" }, { type: "send_feedback" }]).step).toBe("checked_in");
    expect(run([{ type: "check_in" }]).step).toBe("code");
  });
});
