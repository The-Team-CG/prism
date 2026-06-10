import { describe, expect, it } from "vitest";
import {
  PRISM_LIFECYCLE_STAGES,
  canClientAccessPortal,
  canCreateEventWorkspace,
  type PrismLifecycleStage,
} from "./index";

describe("P.R.I.S.M lifecycle contract", () => {
  it("keeps the accepted inquiry plus signed conforme gate explicit", () => {
    expect(PRISM_LIFECYCLE_STAGES).toEqual([
      "inquiry",
      "conforme",
      "briefing_proposal",
      "planning",
      "event_day",
      "closure_archive",
    ]);

    const stage: PrismLifecycleStage = "planning";
    expect(stage).toBe("planning");
  });

  it("allows client portal access only after inquiry acceptance and signed conforme", () => {
    expect(
      canClientAccessPortal({
        inquiryStatus: "accepted",
        conformeStatus: "signed",
      }),
    ).toBe(true);

    expect(
      canClientAccessPortal({
        inquiryStatus: "new",
        conformeStatus: "signed",
      }),
    ).toBe(false);

    expect(
      canClientAccessPortal({
        inquiryStatus: "accepted",
        conformeStatus: "pending",
      }),
    ).toBe(false);
  });

  it("allows event workspace creation only after the same gate", () => {
    expect(canCreateEventWorkspace({ inquiryStatus: "accepted", conformeStatus: "signed" })).toBe(true);
    expect(canCreateEventWorkspace({ inquiryStatus: "accepted", conformeStatus: "pending" })).toBe(false);
  });
});
