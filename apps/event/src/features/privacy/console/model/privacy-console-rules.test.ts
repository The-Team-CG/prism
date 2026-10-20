import { describe, expect, it } from "vitest";
import { PRISM_PRIVACY_REQUEST_UNASSIGNED, listPrivacyRequestsQuerySchema } from "@prism/types";
import { initialPrivacyConsoleFilters, privacyDeadlineLabel, privacyQueueQuery, privacyQueueSearch } from "./privacy-console-rules";

const now = new Date("2026-10-19T12:00:00.000Z");
const request = (overrides: Partial<Parameters<typeof privacyDeadlineLabel>[0]>) => ({
  status: "submitted", dueAt: "2026-10-25T00:00:00.000Z", overdue: false, ...overrides,
});

describe("privacy console queue query", () => {
  it("sends only the filters the operator set, and a query the API schema accepts", () => {
    const query = privacyQueueQuery({ ...initialPrivacyConsoleFilters, status: "open", deadline: "overdue", eventId: "evt_1" }, 2, "usr_1");
    expect(privacyQueueSearch(query!)).toBe("?eventId=evt_1&status=open&requestType=all&subjectType=all&overdue=true&page=2&limit=25");
    expect(listPrivacyRequestsQuerySchema.safeParse(query).success).toBe(true);
  });

  it("maps the assignment filter to the operator id, the unassigned sentinel, or nothing", () => {
    expect(privacyQueueQuery({ ...initialPrivacyConsoleFilters, assignment: "mine" }, 0, "usr_1")).toMatchObject({ assignedTo: "usr_1" });
    expect(privacyQueueQuery({ ...initialPrivacyConsoleFilters, assignment: "unassigned" }, 0, null))
      .toMatchObject({ assignedTo: PRISM_PRIVACY_REQUEST_UNASSIGNED });
    expect(privacyQueueQuery(initialPrivacyConsoleFilters, 0, null)).not.toHaveProperty("assignedTo");
  });

  it("does not build a 'mine' query without a signed-in operator, so it cannot widen to everyone's requests", () => {
    expect(privacyQueueQuery({ ...initialPrivacyConsoleFilters, assignment: "mine" }, 0, null)).toBeNull();
  });

  it("keeps the on-track filter as an explicit overdue=false", () => {
    expect(privacyQueueSearch(privacyQueueQuery({ ...initialPrivacyConsoleFilters, deadline: "on-track" }, 0, null)!)).toContain("overdue=false");
  });
});

describe("privacyDeadlineLabel", () => {
  it("counts whole days past the deadline for overdue open requests", () => {
    expect(privacyDeadlineLabel(request({ overdue: true, dueAt: "2026-10-17T00:00:00.000Z" }), now))
      .toBe("Overdue by 2 days (due 2026-10-17)");
  });

  it("shows days left for requests still inside the SLA, never below zero", () => {
    expect(privacyDeadlineLabel(request({ dueAt: "2026-10-20T06:00:00.000Z" }), now)).toBe("Due 2026-10-20 (1 day left)");
  });

  it("does not present executed or rejected requests as overdue, however late they were closed", () => {
    expect(privacyDeadlineLabel(request({ status: "executed", overdue: false, dueAt: "2026-09-01T00:00:00.000Z" }), now)).toBe("Closed");
    expect(privacyDeadlineLabel(request({ status: "rejected", overdue: false, dueAt: "2026-09-01T00:00:00.000Z" }), now)).toBe("Closed");
  });
});
