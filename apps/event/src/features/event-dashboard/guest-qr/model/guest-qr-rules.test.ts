import type { PrismGuestRosterEntry, PrismGuestQrPassDeliveryStatus, PrismGuestQrPassStatus } from "@prism/types";
import { describe, expect, it } from "vitest";
import { canIssueGuestQrPass, guestQrPassDeliveryLabel, latestGuestQrPassForRosterEntry } from "./guest-qr-rules";

const importedRosterEntry: PrismGuestRosterEntry = {
  id: "gre_1",
  eventId: "evt_1",
  sourceKey: "import-1",
  guestName: "Ada Lovelace",
  email: "ada@example.test",
  eligibility: "eligible",
  verificationStatus: "verified",
  source: "xperto",
  importBatchId: "batch_1",
};

describe("guest QR pass rules", () => {
  it("offers issuance only for imported, active, eligible rows with email and no review source", () => {
    expect(canIssueGuestQrPass(importedRosterEntry)).toBe(true);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, email: null })).toBe(false);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, importBatchId: null })).toBe(false);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, source: "guest-review" })).toBe(false);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, eligibility: "ineligible" })).toBe(false);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, verificationStatus: "rejected" })).toBe(false);
    expect(canIssueGuestQrPass({ ...importedRosterEntry, withdrawnAt: "2026-10-01T00:00:00.000Z" })).toBe(false);
  });

  it.each([
    ["queued", "Queued"],
    ["captured", "Captured for demo; not sent."],
    ["failed", "Failed"],
    ["revoked", "Revoked"],
  ] as const)("labels %s without implying provider delivery", (status, label) => {
    expect(guestQrPassDeliveryLabel(status as PrismGuestQrPassDeliveryStatus)).toBe(label);
  });

  it("prefers the active pass over older revoked history", () => {
    const pass = (id: string, status: PrismGuestQrPassStatus["status"], issuedAt: string): PrismGuestQrPassStatus => ({
      id,
      eventId: "evt_1",
      rosterEntryId: "gre_1",
      status,
      deliveryStatus: status === "active" ? "captured" : "revoked",
      issuedAt,
      revokedAt: status === "revoked" ? issuedAt : null,
    });
    const active = pass("active", "active", "2026-10-01T00:00:00.000Z");
    const historical = pass("old", "revoked", "2026-10-17T00:00:00.000Z");

    expect(latestGuestQrPassForRosterEntry([historical, active], "gre_1")).toEqual(active);
    expect(latestGuestQrPassForRosterEntry([historical], "gre_1")).toEqual(historical);
    expect(latestGuestQrPassForRosterEntry([], "gre_1")).toBeNull();
  });
});
