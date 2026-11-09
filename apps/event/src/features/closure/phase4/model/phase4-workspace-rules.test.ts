import { describe, expect, it } from "vitest";
import {
  closeGateDestination,
  compliancePhaseForStage,
  isCompliancePhase,
  CLOSURE_TABS,
  phase4ArchiveStatus,
  phase4BillingSourceCard,
  phase4CloseGatesCard,
  phase4ComplianceCard,
  phase4StatusLabel,
  phase4StatusTone,
} from "./phase4-workspace-rules";

describe("phase4-workspace-rules", () => {
  it("runs closure tabs in order with Archive last, unnumbered so they read as sections, not a wizard", () => {
    expect(CLOSURE_TABS.map((tab) => [tab.id, tab.label])).toEqual([
      ["wrap-up", "Wrap up"],
      ["feedback", "Feedback & reviews"],
      ["compliance", "Compliance"],
      ["deliverables", "Deliverables"],
      ["archive", "Archive"],
    ]);
  });

  it("sends each unpassed archive gate to the place that resolves it", () => {
    expect(closeGateDestination("documents")).toEqual({ kind: "closure-tab", tabId: "deliverables", label: "Open Deliverables" });
    expect(closeGateDestination("billing")).toEqual({ kind: "event-tab", tab: "billing", label: "Open Billing" });
    expect(closeGateDestination("logistics")).toEqual({ kind: "closure-tab", tabId: "wrap-up", label: "Open Wrap up" });
    expect(closeGateDestination("issues")).toEqual({ kind: "event-tab", tab: "live-ops", label: "Open Live ops" });
    expect(closeGateDestination("feedback")).toMatchObject({ kind: "closure-tab", tabId: "feedback" });
    expect(closeGateDestination("unknown_gate")).toBeNull();
  });

  it("writes status words in sentence case", () => {
    expect(phase4StatusLabel("open")).toBe("Open");
    expect(phase4StatusLabel("not_applicable")).toBe("Not applicable");
  });

  it("maps archive status copy", () => {
    expect(phase4ArchiveStatus(true, false)).toEqual({ label: "Archived", toneKey: "approved" });
    expect(phase4ArchiveStatus(false, true)).toEqual({ label: "Ready for archive", toneKey: "approved" });
    expect(phase4ArchiveStatus(false, false)).toEqual({ label: "Not ready to archive", toneKey: "open" });
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

  it("starts a compliance run in the phase the event is in, not always Planning", () => {
    expect(compliancePhaseForStage("briefing_proposal")).toBe("planning");
    expect(compliancePhaseForStage("planning")).toBe("planning");
    expect(compliancePhaseForStage("event_day")).toBe("event_day");
    expect(compliancePhaseForStage("closure_archive")).toBe("closure");
    expect(isCompliancePhase("closure")).toBe(true);
    expect(isCompliancePhase("Planning")).toBe(false);
  });

  it("maps status tones and rule layers", () => {
    expect(phase4StatusTone("approved")).toContain("success");
    expect(phase4StatusTone("open")).toContain("attention");
  });
});
