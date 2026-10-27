import { describe, expect, it } from "vitest";
import {
  phase4ArchiveStatus,
  phase4BillingSourceCard,
  phase4CloseGatesCard,
  phase4ComplianceCard,
  phase4RuleLayer,
  phase4StatusTone,
} from "./phase4-workspace-rules";

describe("phase4-workspace-rules", () => {
  it("maps archive status copy", () => {
    expect(phase4ArchiveStatus(true, false)).toEqual({ label: "Archived", toneKey: "approved" });
    expect(phase4ArchiveStatus(false, true)).toEqual({ label: "Ready for archive", toneKey: "approved" });
    expect(phase4ArchiveStatus(false, false)).toEqual({ label: "Archive gated", toneKey: "open" });
  });

  it("builds closure cards", () => {
    expect(phase4CloseGatesCard(null).value).toBe("Loading");
    expect(phase4CloseGatesCard({ ready: true, gates: [{ passed: true }, { passed: false }] })).toMatchObject({
      value: "1/2",
      detail: "Ready to archive",
    });
    expect(phase4ComplianceCard(2, 5).tone).toBe("text-danger");
    expect(phase4BillingSourceCard({ totalAmount: 100 }, 1, (amount) => String(amount)).value).toBe("Approved");
  });

  it("maps status tones and rule layers", () => {
    expect(phase4StatusTone("approved")).toContain("emerald");
    expect(phase4StatusTone("open")).toContain("amber");
    expect(phase4RuleLayer("watch_out")).toBe("Should-Fix");
    expect(phase4RuleLayer("must_fix")).toBe("Must-Fix");
  });
});
