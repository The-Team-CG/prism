import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createFloorPlanPreference: vi.fn(),
  savePlan: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../data/client-dashboard-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/client-dashboard-repository")>();
  return { clientDashboardRepository: { ...actual.clientDashboardRepository, ...repository } };
});

import { PRISM_SESSION_STORAGE_KEYS, type PrismFloorPlanDraft } from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { signOutClientSession, submitFloorPlanEditorProject } from "./client-dashboard-actions";

describe("submitFloorPlanEditorProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resubmits a reopened preference with the updated canvas through the preference command", async () => {
    const draft: PrismFloorPlanDraft = {
      id: "fpd_preference",
      eventId: "evt_1",
      floorPlanId: "plan_preference",
      name: "Summit layout preference",
      status: "revision_requested",
      isActive: false,
      sourceType: "client_preference",
      createdByRole: "client",
      clientPreference: {
        seatingStyle: "Banquet",
        stagePreference: "North wall",
        flowNotes: "Keep registration clear",
        guestCount: 180,
        constraints: ["Keep exits clear"],
      },
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };
    const project: Project = {
      id: "plan_preference",
      name: "Revised summit preference",
      venue: "Grand Hall",
      widthM: 35,
      heightM: 22,
      pax: 200,
      objects: [{
        id: "stage", name: "Main stage", kind: "rect", category: "stage", x: 4, y: 5, w: 6, h: 2,
        rotation: 0, fill: "#fff", stroke: "#000", strokeWidth: 1, locked: false, hidden: false,
      }],
      guests: [],
      suppliers: [],
      createdAt: 0,
      updatedAt: 0,
    };

    await submitFloorPlanEditorProject("evt_1", draft, project);

    expect(repository.createFloorPlanPreference).toHaveBeenCalledWith("evt_1", expect.objectContaining({
      name: "Revised summit preference",
      guestCount: 200,
      venue: "Grand Hall",
      width: 35,
      height: 22,
      objects: project.objects,
    }));
    expect(repository.savePlan).not.toHaveBeenCalled();
  });
});

describe("signOutClientSession", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clears the stored client session and resolves when the server logout fails", async () => {
    const storage = new Map<string, string>([
      [PRISM_SESSION_STORAGE_KEYS.client, JSON.stringify({ accessToken: "stored-token" })],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
    repository.logout.mockRejectedValueOnce(new Error("Network unreachable"));

    await expect(signOutClientSession()).resolves.toBeUndefined();

    expect(repository.logout).toHaveBeenCalledTimes(1);
    expect(storage.has(PRISM_SESSION_STORAGE_KEYS.client)).toBe(false);
  });
});
