import { describe, expect, it } from "vitest";
import type { PrismEventWrapUp } from "@prism/types";
import { wrapUpLogisticsMirror, wrapUpWritableRequiredItems } from "./wrap-up-rules";

function wrapUp(logisticsStatus: "pending" | "complete", logisticsRequired: boolean): PrismEventWrapUp {
  return {
    id: "wrap_1",
    eventId: "event_1",
    mode: "full",
    status: "pending",
    activatedAt: "2026-10-17T18:00:00.000Z",
    deadlineAt: "2026-10-18T18:00:00.000Z",
    twelveHourReminderAt: null,
    twentyFourHourReminderAt: null,
    requiredItems: { post_event_documents: true, logistics: logisticsRequired },
    sections: {
      logistics: { status: logisticsStatus, evidence: "", completedAt: null },
      issues: { status: "pending", evidence: "", completedAt: null },
      feedback: { status: "pending", evidence: "", completedAt: null },
    },
    clientAcknowledgedAt: null,
    acknowledgementRecordedBy: null,
    acknowledgementSource: "pmcm_recorded",
    clientAcknowledgementNote: "",
    completedAt: null,
    completedBy: null,
  };
}

describe("wrap-up logistics mirror", () => {
  it("shows logistics as not recorded and points to the panel until the record exists", () => {
    const mirror = wrapUpLogisticsMirror(wrapUp("pending", false));
    expect(mirror.complete).toBe(false);
    expect(mirror.label).toMatch(/Record logistics completion in the panel above/);
  });

  it("reflects a recorded logistics completion in the checklist", () => {
    expect(wrapUpLogisticsMirror(wrapUp("complete", true))).toMatchObject({ complete: true, label: expect.stringMatching(/Recorded in the logistics completion panel/) });
  });

  it("does not treat a stored complete section without the mirrored requirement as recorded", () => {
    expect(wrapUpLogisticsMirror(wrapUp("complete", false)).complete).toBe(false);
  });

  it("drops logistics from the checklist payload so it cannot be written from here", () => {
    expect(wrapUpWritableRequiredItems({ post_event_documents: true, logistics: true, issues: false })).toEqual({ post_event_documents: true, issues: false });
  });
});
