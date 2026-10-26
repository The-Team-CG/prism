import { describe, expect, it } from "vitest";
import { adminAccountActionsFor, summarizeAuditTrail } from "./audit-trail-rules";

describe("audit-trail-rules", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const active = { role: "coordinator", approvalStatus: "approved", lockedUntil: null, permanentLockout: false } as const;

  it.each([
    {
      name: "PMCM admin viewing an active coordinator",
      user: active,
      viewer: "pmcm-admin" as const,
      expected: { unlockAccount: false, resetTwoFactor: false, resendInvitation: false },
    },
    {
      name: "PMCM admin viewing a temporarily locked coordinator",
      user: { ...active, lockedUntil: "2026-10-26T00:00:00.000Z" },
      viewer: "pmcm-admin" as const,
      expected: { unlockAccount: true, resetTwoFactor: false, resendInvitation: false },
    },
    {
      name: "PMCM admin viewing a permanently locked PMCM admin whose lock time has passed",
      user: { ...active, role: "pmcm-admin" as const, lockedUntil: "2026-10-01T00:00:00.000Z", permanentLockout: true },
      viewer: "pmcm-admin" as const,
      expected: { unlockAccount: true, resetTwoFactor: true, resendInvitation: false },
    },
    {
      name: "PMCM admin viewing an invited coordinator",
      user: { ...active, approvalStatus: "invited" },
      viewer: "pmcm-admin" as const,
      expected: { unlockAccount: false, resetTwoFactor: false, resendInvitation: true },
    },
    {
      name: "PMCM admin viewing an invited PMCM admin",
      user: { ...active, role: "pmcm-admin" as const, approvalStatus: "invited" },
      viewer: "pmcm-admin" as const,
      expected: { unlockAccount: false, resetTwoFactor: true, resendInvitation: true },
    },
    {
      name: "coordinator viewing a locked, invited PMCM admin gets no admin action",
      user: { ...active, role: "pmcm-admin" as const, approvalStatus: "invited", permanentLockout: true },
      viewer: "coordinator" as const,
      expected: { unlockAccount: false, resetTwoFactor: false, resendInvitation: false },
    },
  ])("$name", ({ user, viewer, expected }) => {
    expect(adminAccountActionsFor(user, viewer, now)).toEqual(expected);
  });

  it("summarizes audit, login, approval, and privacy backlog metrics", () => {
    const summary = summarizeAuditTrail({
      logs: [
        { actorRole: "pmcm-admin" },
        { actorRole: "system" },
      ],
      alerts: [{ status: "open" }, { status: "resolved" }],
      loginHistory: [{ status: "failed" }, { status: "success" }],
      approvalRequests: [{ status: "pending" }, { status: "approved" }],
      privacySubmittedCount: 1,
      privacyInventory: {
        retentionNotes: ["Keep only what is needed"],
        globalSurfaces: [{ recordCount: 3, missingConsentCount: 1 }],
        events: [{ surfaces: [{ recordCount: 2, missingConsentCount: 0 }] }],
      },
    });

    expect(summary).toEqual({
      userActionCount: 1,
      systemActionCount: 1,
      openAlertCount: 1,
      failedLoginCount: 1,
      approvalBacklog: 1,
      privacyBacklog: 1,
      privacyRecordCount: 5,
      missingConsentCount: 1,
      privacySurfaceCount: 2,
      retentionNote: "Keep only what is needed",
    });
  });
});
