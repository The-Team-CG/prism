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
  watermark: "2026-06-01T00:00:00.000Z",
  feedbackAvailability: "not_open",
  openedAt: "2026-06-01T00:00:00.000Z",
} as GuestSession;

describe("refreshGuestEventIfChanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch the full event when the watermark is unchanged", async () => {
    repository.fetchWatermark.mockResolvedValue({ watermark: session.watermark, feedbackAvailability: "not_open" });

    await expect(refreshGuestEventIfChanged(session)).resolves.toBe(session);
    expect(repository.fetchEvent).not.toHaveBeenCalled();
    expect(repository.saveSession).not.toHaveBeenCalled();
  });

  it("updates feedback availability when its window changes without an event edit", async () => {
    repository.fetchWatermark.mockResolvedValue({ watermark: session.watermark, feedbackAvailability: "open" });

    await expect(refreshGuestEventIfChanged(session)).resolves.toMatchObject({ feedbackAvailability: "open" });
    expect(repository.fetchEvent).not.toHaveBeenCalled();
    expect(repository.saveSession).toHaveBeenCalledWith(expect.objectContaining({ feedbackAvailability: "open" }));
  });

  it("fetches and persists the full event when the watermark changes", async () => {
    repository.fetchWatermark.mockResolvedValue({ watermark: "2026-06-02T00:00:00.000Z" });
    repository.fetchEvent.mockResolvedValue({ ...session, watermark: "2026-06-02T00:00:00.000Z" });

    await expect(refreshGuestEventIfChanged(session)).resolves.toMatchObject({ watermark: "2026-06-02T00:00:00.000Z" });
    expect(repository.fetchEvent).toHaveBeenCalledWith(session);
    expect(repository.saveSession).toHaveBeenCalledWith(expect.objectContaining({ watermark: "2026-06-02T00:00:00.000Z" }));
  });
});
