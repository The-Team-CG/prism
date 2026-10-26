import { describe, expect, it } from "vitest";
import { canResendPortalInvitation, onboardingTimelineSteps, reminderEvidenceCopy } from "./client-onboarding-rules";
import type { PrismInquiry } from "@prism/types";

function inquiry(overrides: Partial<PrismInquiry>): PrismInquiry {
  return {
    id: "inq_1",
    clientName: "Ada",
    companyName: "Acme",
    email: "ada@acme.test",
    eventName: "Gala",
    eventType: "Gala",
    eventDate: "2026-09-20",
    clientType: "Corporate",
    source: "Walk-In",
    message: "Hello",
    status: "accepted",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("client-onboarding-rules", () => {
  it("includes invitation sent, opened, and expired evidence", () => {
    const opened = onboardingTimelineSteps(
      inquiry({
        acceptedAt: "2026-09-01T00:00:00.000Z",
        portalInvitationStatus: "opened",
        portalInvitationSentAt: "2026-09-02T00:00:00.000Z",
        portalInvitationOpenedAt: "2026-09-03T00:00:00.000Z",
      }),
      (value) => value ?? "",
    );
    expect(opened.map((step) => step.title)).toContain("Invitation sent");
    expect(opened.find((step) => step.title === "Invitation opened")?.done).toBe(true);

    const expired = onboardingTimelineSteps(
      inquiry({ portalInvitationStatus: "expired", portalInvitationExpiresAt: "2026-09-10T00:00:00.000Z" }),
      (value) => value ?? "",
    );
    expect(expired.find((step) => step.title === "Invitation expired")?.done).toBe(true);
  });

  it.each([
    { status: "not_sent", viewer: "pmcm-admin" as const, expected: true },
    { status: "expired", viewer: "pmcm-admin" as const, expected: true },
    { status: "sent", viewer: "pmcm-admin" as const, expected: false },
    { status: "opened", viewer: "pmcm-admin" as const, expected: false },
    { status: "expired", viewer: "coordinator" as const, expected: false },
    { status: "not_sent", viewer: null, expected: false },
  ])("resend availability for status $status and viewer $viewer is $expected", ({ status, viewer, expected }) => {
    expect(canResendPortalInvitation({ portalInvitationStatus: status }, viewer)).toBe(expected);
  });

  it("surfaces last reminder evidence when present", () => {
    expect(
      reminderEvidenceCopy(inquiry({ lastConformeReminderAt: "2026-09-04T00:00:00.000Z" }), (value) => value ?? ""),
    ).toBe("Last reminder: 2026-09-04T00:00:00.000Z");
  });
});
