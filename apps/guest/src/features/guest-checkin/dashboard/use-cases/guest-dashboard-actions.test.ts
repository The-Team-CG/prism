import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuestSession } from "../model/guest-dashboard-types";

const repository = vi.hoisted(() => ({
  fetchWatermark: vi.fn(),
  fetchEvent: vi.fn(),
  saveSession: vi.fn(),
}));

vi.mock("../data/guest-dashboard-repository", () => ({
  guestDashboardRepository: repository,
}));

import { refreshGuestEventIfChanged } from "./guest-dashboard-actions";

const session = {
  id: "evt_sample",
  eventName: "Ayala Tech Summit",
  eventDate: "2026-06-18",
  clientName: "Ana Reyes",
  readiness: "Registration open",
  floorPlanStatus: "approved",
  guestAccessCode: "AYALA-TECH-MPLE",
  attendanceCount: 1,
  watermark: "2026-06-01T00:00:00.000Z:1",
  guestName: "Sofia Lim",
  openedAt: "2026-06-01T00:00:00.000Z",
} as GuestSession;

describe("refreshGuestEventIfChanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch the full event when the watermark is unchanged", async () => {
    repository.fetchWatermark.mockResolvedValue({ watermark: session.watermark });

    await expect(refreshGuestEventIfChanged(session)).resolves.toBe(session);
    expect(repository.fetchEvent).not.toHaveBeenCalled();
    expect(repository.saveSession).not.toHaveBeenCalled();
  });

  it("fetches and persists the full event when the watermark changes", async () => {
    repository.fetchWatermark.mockResolvedValue({ watermark: "2026-06-01T00:00:00.000Z:2" });
    repository.fetchEvent.mockResolvedValue({ ...session, attendanceCount: 2, watermark: "2026-06-01T00:00:00.000Z:2" });

    await expect(refreshGuestEventIfChanged(session)).resolves.toMatchObject({ attendanceCount: 2 });
    expect(repository.fetchEvent).toHaveBeenCalledWith(session);
    expect(repository.saveSession).toHaveBeenCalledWith(expect.objectContaining({ attendanceCount: 2 }));
  });
});
