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

  it("reopens a client floorplan preference through the event-scoped PMCM endpoint", async () => {
    await eventDashboardCommands.reopenClientPreference("evt_1", "fpd_1");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:4000/api/events/evt_1/floorplans/fpd_1/reopen-preference",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer session-token");
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

  it("sends inquiry decisions and the conforme upload with the bodies the API reads", async () => {
    await eventDashboardCommands.acceptInquiry("inq_1");
    await eventDashboardCommands.declineInquiry("inq_1", "Budget Too Low");
    await eventDashboardCommands.declineInquiry("inq_1", "");
    await eventDashboardCommands.pendInquiry("inq_1");
    await eventDashboardCommands.uploadConforme("inq_1", { fileName: "conforme.pdf", mimeType: "application/pdf", sizeBytes: 1024 });

    const sent = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ call: `${init?.method} ${String(url).replace("http://localhost:4000/api", "")}`, body: JSON.parse(String(init?.body)) }));
    expect(sent).toEqual([
      { call: "PATCH /inquiries/inq_1/status", body: { status: "accepted" } },
      { call: "PATCH /inquiries/inq_1/status", body: { status: "declined", declineReason: "Budget Too Low" } },
      { call: "PATCH /inquiries/inq_1/status", body: { status: "declined" } },
      { call: "PATCH /inquiries/inq_1/status", body: { status: "pending" } },
      { call: "POST /inquiries/inq_1/conforme", body: { type: "signed_conforme", fileName: "conforme.pdf", mimeType: "application/pdf", sizeBytes: 1024 } },
    ]);
  });

  it("refuses a decline reason the API does not accept before anything is sent", () => {
    expect(() => eventDashboardCommands.declineInquiry("inq_1", "Not interested")).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends coordinator staffing commands to the event-scoped staffing routes", async () => {
    await eventDashboardCommands.loadCoordinatorSuggestions("evt_1", { role: "Registration Lead", skills: ["Check-in", "Ushering"] } as never);
    await eventDashboardCommands.sendCoordinatorAcknowledgementReminders("evt_1");
    await eventDashboardCommands.deleteCoordinatorAvailability("evt_1", "coord_1", "avail_1");

    const sent = vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url).replace("http://localhost:4000/api", "")}`);
    expect(sent).toEqual([
      "GET /events/evt_1/staffing/coordinator-suggestions?role=Registration+Lead&skills=Check-in&skills=Ushering",
      "POST /events/evt_1/staffing/acknowledgement-reminders",
      "DELETE /events/evt_1/coordinators/coord_1/availability/avail_1",
    ]);
  });
});
