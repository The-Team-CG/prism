import { describe, expect, it } from "vitest";
import { PRISM_PRIVACY_REQUEST_UNASSIGNED, listPrivacyRequestsQuerySchema } from "@prism/types";
import { toQueryString } from "@prism/api-client";
import { initialPrivacyConsoleFilters, isClosedPrivacyRequest, privacyQueueQuery } from "./privacy-console-rules";

/** The query string the client sends for a queue query. */
const privacyQueueSearch = (query: Parameters<typeof toQueryString>[0]) => `?${toQueryString(query)}`;


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

describe("isClosedPrivacyRequest", () => {
  it("treats executed, rejected and withdrawn requests as closed, so they show no countdown or actions", () => {
    expect(["executed", "rejected", "cancelled"].every(isClosedPrivacyRequest)).toBe(true);
    expect(["submitted", "approved"].some(isClosedPrivacyRequest)).toBe(false);
  });
});
