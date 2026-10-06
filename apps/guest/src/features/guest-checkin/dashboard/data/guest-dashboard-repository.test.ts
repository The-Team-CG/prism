import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@prism/types", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prism/types")>();
  return {
    ...original,
    readPrismSession: storage.read,
    savePrismSession: storage.save,
  };
});

import { guestDashboardRepository } from "./guest-dashboard-repository";

const storedSession = {
  eventName: "Yala",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  watermark: "2026-08-01T00:00:00.000Z",
  openedAt: "2026-07-01T00:00:00.000Z",
};

describe("guest dashboard session storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes names from legacy saved sessions before returning them", () => {
    storage.read.mockReturnValue({ ...storedSession, guestName: "Legacy Name", attendanceCount: 4 });

    const session = guestDashboardRepository.readSession();

    expect(session).toEqual(storedSession);
    expect(session).not.toHaveProperty("guestName");
    expect(storage.save).toHaveBeenCalledWith(expect.any(String), storedSession);
  });

  it("does not rewrite sessions that already contain no guest name", () => {
    storage.read.mockReturnValue(storedSession);

    expect(guestDashboardRepository.readSession()).toEqual(storedSession);
    expect(storage.save).not.toHaveBeenCalled();
  });
});
