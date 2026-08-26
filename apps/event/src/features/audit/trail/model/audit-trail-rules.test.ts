import { describe, expect, it } from "vitest";
import { summarizeAuditTrail } from "./audit-trail-rules";

describe("audit-trail-rules", () => {
  it("summarizes audit, login, approval, and privacy backlog metrics", () => {
    const summary = summarizeAuditTrail({
      logs: [
        { actorRole: "pmcm-admin" },
        { actorRole: "system" },
      ],
      alerts: [{ status: "open" }, { status: "resolved" }],
      loginHistory: [{ status: "failed" }, { status: "success" }],
      approvalRequests: [{ status: "pending" }, { status: "approved" }],
      privacyRequests: [{ status: "submitted" }, { status: "executed" }],
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
