import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
}));

const http = vi.hoisted(() => ({ guestJson: vi.fn() }));

vi.mock("@prism/types", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prism/types")>();
  return {
    ...original,
    readPrismSession: storage.read,
    savePrismSession: storage.save,
  };
});

vi.mock("@/features/guest-shared/guest-http", () => ({ guestJson: http.guestJson }));

import { guestDashboardRepository } from "./guest-dashboard-repository";

const storedSession = {
  id: "evt_yala",
  eventName: "Yala",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  watermark: "2026-08-01T00:00:00.000Z",
  openedAt: "2026-07-01T00:00:00.000Z",
};

const pendingRequests = new Map<string, string>();
const sessionStorageMock = {
  getItem: (key: string) => pendingRequests.get(key) ?? null,
  setItem: (key: string, value: string) => pendingRequests.set(key, value),
  removeItem: (key: string) => pendingRequests.delete(key),
};

describe("guest dashboard session storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingRequests.clear();
    vi.stubGlobal("sessionStorage", sessionStorageMock);
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it("reuses a pending request key after a lost response and clears it after acceptance", async () => {
    const payload = {
      checkInMode: "headcount" as const,
      privacyConsentAccepted: true as const,
      privacyNoticeVersion: "2026-05-01",
      marketingConsentAccepted: false,
    };
    http.guestJson.mockRejectedValueOnce(new TypeError("Connection reset"));
    http.guestJson.mockResolvedValueOnce({ accepted: true });

    await expect(guestDashboardRepository.checkIn(storedSession as never, payload)).rejects.toThrow("Connection reset");
    const firstRequest = JSON.parse(http.guestJson.mock.calls[0]?.[1]?.body as string) as { idempotencyKey: string };

    await expect(guestDashboardRepository.checkIn(storedSession as never, payload)).resolves.toEqual({ accepted: true });
    const retry = JSON.parse(http.guestJson.mock.calls[1]?.[1]?.body as string) as { idempotencyKey: string };

    expect(firstRequest.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(retry.idempotencyKey).toBe(firstRequest.idempotencyKey);
    expect(pendingRequests.size).toBe(0);
  });
});
