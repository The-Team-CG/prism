import { describe, expect, it } from "vitest";
import { canCheckInRegistrationEntry } from "./registration-rules";

const entry = {
  id: "gre_1",
  eventId: "evt_1",
  guestName: "Mia Santos",
  eligibility: "eligible",
  verificationStatus: "pending" as const,
  checkedInAt: null,
  walkIn: false,
};

describe("coordinator registration rules", () => {
  it("permits an eligible guest until they are checked in or rejected", () => {
    expect(canCheckInRegistrationEntry(entry)).toBe(true);
    expect(canCheckInRegistrationEntry({ ...entry, checkedInAt: "2026-10-02T09:00:00.000Z" })).toBe(false);
    expect(canCheckInRegistrationEntry({ ...entry, verificationStatus: "rejected" })).toBe(false);
    expect(canCheckInRegistrationEntry({ ...entry, eligibility: "ineligible" })).toBe(false);
    expect(canCheckInRegistrationEntry({ ...entry, walkIn: true })).toBe(false);
    expect(canCheckInRegistrationEntry({ ...entry, walkIn: true, verificationStatus: "verified" })).toBe(true);
  });
});
