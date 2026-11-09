import { describe, expect, it } from "vitest";
import { clientEventsEmptyCopy, type ClientEventsFilterId } from "./client-events-empty-copy";

describe("client events empty copy", () => {
  it("writes copy for each filter and offers a new request only where one can still apply", () => {
    const titles = new Map<ClientEventsFilterId, string>();
    const offers = (id: ClientEventsFilterId) => clientEventsEmptyCopy(id, false).offersNewRequest;
    for (const id of ["events-all", "events-upcoming", "events-in-planning", "events-completed", "events-cancelled"] as const) {
      titles.set(id, clientEventsEmptyCopy(id, false).title);
    }

    expect(new Set(titles.values()).size).toBe(5);
    expect(offers("events-cancelled")).toBe(false);
    expect(offers("events-completed")).toBe(false);
    expect(offers("events-all")).toBe(true);
    expect(offers("events-upcoming")).toBe(true);
    expect(offers("events-in-planning")).toBe(true);
  });

  it("explains a search with no match without offering to start a request", () => {
    expect(clientEventsEmptyCopy("events-all", true)).toEqual({
      title: "No events match",
      description: "Try a different name, date or status.",
      offersNewRequest: false,
    });
  });
});
