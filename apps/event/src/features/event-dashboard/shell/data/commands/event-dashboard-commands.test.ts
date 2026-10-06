import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRISM_SESSION_STORAGE_KEYS } from "@prism/types";
import { eventDashboardCommands } from "../event-dashboard-commands";

describe("PMCM dashboard command transport", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) =>
          key === PRISM_SESSION_STORAGE_KEYS.event
            ? JSON.stringify({
                id: "pmcm_1",
                name: "Maxine Santos",
                email: "maxine@pmcm.test",
                role: "pmcm-admin",
                organization: "P.R.I.S.M",
                approvalStatus: "approved",
                accessToken: "session-token",
                expiresAt: "2099-01-01T00:00:00.000Z",
                signedInAt: "2026-09-30T00:00:00.000Z",
              })
            : null,
        ),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { id: "evt_1", archived: true } }), {
          headers: { "content-type": "application/json" },
        })),
      ),
    );
  });

  it("loads and updates guest privacy through the session-authenticated command", async () => {
    await eventDashboardCommands.getGuestPrivacyClassification("evt_1");
    await eventDashboardCommands.updateGuestPrivacyClassification("evt_1", { classification: "private" });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/events/evt_1/guest-privacy");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/events/evt_1/guest-privacy");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ classification: "private" }),
    });
    for (const [, requestInit] of fetchMock.mock.calls) {
      expect(new Headers(requestInit?.headers).get("authorization")).toContain("Bearer");
    }
  });

  it("uses the verified session token without sending a caller supplied actor name", async () => {
    await eventDashboardCommands.archiveEvent("evt_1", "archive approved by PMCM");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("http://localhost:4000/api/events/evt_1/archive");
    expect(new Headers(requestInit?.headers).get("authorization")).toBe("Bearer session-token");
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      overrideReason: "archive approved by PMCM",
    });
  });
});
