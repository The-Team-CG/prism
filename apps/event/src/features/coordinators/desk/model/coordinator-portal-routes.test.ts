import { describe, expect, it } from "vitest";
import { COORDINATOR_VIEW_LABELS, coordinatorLocationRedirect, coordinatorViewFromParam } from "./coordinator-portal-routes";

describe("coordinator portal routes", () => {
  it("opens the Games view from ?view=games and keeps it in place", () => {
    expect(coordinatorViewFromParam("games")).toBe("games");
    expect(COORDINATOR_VIEW_LABELS.games).toBe("Games");
    expect(coordinatorLocationRedirect({ pathname: "/dashboard", search: "?view=games&event=evt_1" })).toBeNull();
  });
});
