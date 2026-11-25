import { describe, expect, it } from "vitest";
import { COORDINATOR_VIEW_LABELS, coordinatorLocationRedirect, coordinatorViewFromParam } from "./coordinator-portal-routes";

describe("coordinator portal routes", () => {
  it("opens the Games view from ?view=games and keeps it in place", () => {
    expect(coordinatorViewFromParam("games")).toBe("games");
    expect(COORDINATOR_VIEW_LABELS.games).toBe("Games");
    expect(coordinatorLocationRedirect({ pathname: "/coordinator", search: "?view=games&event=evt_1" })).toBeNull();
  });

  it("brings old /dashboard links home with their view and event, and other PMCM paths home with a notice", () => {
    expect(coordinatorLocationRedirect({ pathname: "/dashboard", search: "?view=tasks&event=evt_1" })).toEqual({ search: "?view=tasks&event=evt_1" });
    expect(coordinatorLocationRedirect({ pathname: "/dashboard/messages", search: "?event=evt_1" })).toEqual({ search: "?event=evt_1&view=messages" });
    expect(coordinatorLocationRedirect({ pathname: "/dashboard/finance", search: "?event=evt_1" })).toEqual({ search: "?view=shift&event=evt_1&notice=outside-portal" });
  });
});
