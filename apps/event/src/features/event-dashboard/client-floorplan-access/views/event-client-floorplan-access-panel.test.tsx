/** @vitest-environment jsdom */
import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismEventClientAccess } from "@prism/types";

vi.mock("../view-models/use-client-floorplan-access-view-model", () => ({
  useClientFloorplanAccessViewModel: vi.fn(),
}));

import { useClientFloorplanAccessViewModel } from "../view-models/use-client-floorplan-access-view-model";
import { EventClientFloorplanAccessPanel } from "./event-client-floorplan-access-panel";

const access: PrismEventClientAccess = {
  eventId: "evt_1",
  primaryContact: { name: "Ana Reyes", email: "ana@example.test" },
  secondaryContacts: [
    { id: "client_2", name: "Ben Cruz", email: "ben@example.test" },
  ],
};

describe("EventClientFloorplanAccessPanel", () => {
  const search = vi.fn();
  const grant = vi.fn();
  const revoke = vi.fn();
  const reload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientFloorplanAccessViewModel).mockReturnValue({
      access,
      candidates: [{ id: "client_3", name: "Cathy Lim", email: "cathy@example.test" }],
      loading: false,
      searching: false,
      busyUserId: null,
      error: null,
      reload,
      search,
      grant,
      revoke,
    });
  });

  it("keeps primary access fixed and exposes add/remove only for secondary accounts", () => {
    render(createElement(EventClientFloorplanAccessPanel, { eventId: "evt_1" }));

    const section = screen.getByRole("region", { name: "Shared floorplan access" });
    expect(within(section).getByText(/Ana Reyes/)).toBeTruthy();
    expect(within(section).getByText(/always has access/)).toBeTruthy();
    expect(within(section).getByText("Ben Cruz")).toBeTruthy();
    expect(within(section).getByText("Cathy Lim")).toBeTruthy();
    expect(within(section).getAllByRole("button", { name: "Remove access" })).toHaveLength(1);

    fireEvent.click(within(section).getByRole("button", { name: "Grant access" }));
    fireEvent.click(within(section).getByRole("button", { name: "Remove access" }));
    expect(grant).toHaveBeenCalledWith("client_3");
    expect(revoke).toHaveBeenCalledWith("client_2");
  });

  it("submits searches for eligible approved Client accounts", () => {
    render(createElement(EventClientFloorplanAccessPanel, { eventId: "evt_1" }));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search approved Client accounts" }), {
      target: { value: "cathy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(search).toHaveBeenCalledWith("cathy");
  });
});
