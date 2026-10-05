import { describe, expect, it } from "vitest";
import type { PrismApprovedClientAccount, PrismEventClientAccess } from "@prism/types";
import { availableClientCandidates, canManageClientFloorplanAccess } from "./client-floorplan-access";

const access: PrismEventClientAccess = {
  eventId: "evt_1",
  primaryContact: { name: "Ana Reyes", email: "Ana@Example.test " },
  secondaryContacts: [
    { id: "client_2", name: "Ben Cruz", email: "ben@example.test" },
  ],
};

const candidates: PrismApprovedClientAccount[] = [
  { id: "primary", name: "Ana Reyes", email: "ana@example.test" },
  { id: "client_2", name: "Ben Cruz", email: "ben@example.test" },
  { id: "client_3", name: "Cathy Lim", email: "cathy@example.test" },
];

describe("availableClientCandidates", () => {
  it("excludes the primary contact and active grants by normalized identity", () => {
    expect(availableClientCandidates(access, candidates)).toEqual([candidates[2]]);
  });

  it("returns no candidates when access has not loaded", () => {
    expect(availableClientCandidates(null, candidates)).toEqual([]);
  });

  it("shows management controls only to PMCM Admin and System actors", () => {
    expect(canManageClientFloorplanAccess("pmcm-admin")).toBe(true);
    expect(canManageClientFloorplanAccess("system")).toBe(true);
    expect(canManageClientFloorplanAccess("coordinator")).toBe(false);
  });
});
