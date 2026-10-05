/** @vitest-environment jsdom */
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismClientSharedFloorplanEntry } from "@prism/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: {
    href: string;
    children: import("react").ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));
vi.mock("../view-models/use-client-shared-floorplans-view-model", () => ({
  useClientSharedFloorplansViewModel: vi.fn(),
}));

import { useClientSharedFloorplansViewModel } from "../view-models/use-client-shared-floorplans-view-model";
import { ClientSharedFloorplansView } from "./client-shared-floorplans-view";

const ENTRY: PrismClientSharedFloorplanEntry = {
  eventId: "evt_1",
  eventName: "Summit",
  eventDate: "2026-11-15T00:00:00.000Z",
  draftId: "draft_1",
  draftName: "Main Hall",
  draftStatus: "in_review",
  availableSnapshots: ["submitted"],
};

describe("ClientSharedFloorplansView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientSharedFloorplansViewModel).mockReturnValue({
      session: null,
      entries: [ENTRY],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
  });

  it("renders only snapshot links returned in the read model", () => {
    render(createElement(ClientSharedFloorplansView));

    expect(screen.getByText("Summit")).toBeTruthy();
    expect(screen.getByText(/Main Hall/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Submitted snapshot" }).getAttribute("href"))
      .toBe("/dashboard/shared-floorplans/evt_1/draft_1/submitted");
    expect(screen.queryByRole("link", { name: "Open Approved snapshot" })).toBeNull();
    expect(screen.queryByText(/Billing|Documents|Timeline|Comment/)).toBeNull();
  });
});
