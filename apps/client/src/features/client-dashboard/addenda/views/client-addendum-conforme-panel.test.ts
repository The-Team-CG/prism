/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismClientAddendumConforme } from "@prism/types";
import { ClientAddendumConformePanel } from "./client-addendum-conforme-panel";

const { list, acknowledge } = vi.hoisted(() => ({ list: vi.fn(), acknowledge: vi.fn() }));
vi.mock("../data/client-addendum-conforme-repository", () => ({
  clientAddendumConformeRepository: { list, acknowledge },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function conforme(overrides: Partial<PrismClientAddendumConforme> = {}): PrismClientAddendumConforme {
  return {
    id: "acx_1", addendumId: "addendum_1", eventId: "evt_1", addendumVersionNumber: 1, addendumTitle: "Stage lighting",
    addendumSummary: "Adds lighting rig", documentVersion: 2, documentContent: "Addendum 1: add stage lighting rig for PHP 5,000.",
    documentSha256: "b".repeat(64), status: "awaiting_client", clientAcknowledgedAt: null, completedAt: null, ...overrides,
  };
}

describe("ClientAddendumConformePanel", () => {
  it("acknowledges only after consent, binding to the displayed version and hash", async () => {
    list.mockResolvedValue([conforme()]);
    acknowledge.mockResolvedValue(conforme({ status: "awaiting_pmcm", clientAcknowledgedAt: "2026-10-19T01:00:00.000Z" }));
    render(createElement(ClientAddendumConformePanel, { eventId: "evt_1" }));

    expect(await screen.findByText("Addendum 1: add stage lighting rig for PHP 5,000.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Acknowledge addendum" });
    expect(button.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith("evt_1", "addendum_1", {
      executionId: "acx_1", documentVersion: 2, documentSha256: "b".repeat(64), consentAccepted: true,
    }));
    expect(await screen.findByText(/Acknowledged, awaiting PMCM countersignature/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Acknowledge addendum" })).toBeNull();
  });

  it("surfaces a server rejection such as a replaced version without marking the addendum acknowledged", async () => {
    list.mockResolvedValue([conforme()]);
    acknowledge.mockRejectedValue(new Error("A newer addendum conforme version is available"));
    render(createElement(ClientAddendumConformePanel, { eventId: "evt_1" }));

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge addendum" }));

    expect((await screen.findByRole("alert")).textContent).toBe("A newer addendum conforme version is available");
    expect(screen.getByText(/Awaiting your acknowledgement/)).toBeTruthy();
  });

  it("stays hidden on the dashboard home when nothing awaits the client", async () => {
    list.mockResolvedValue([conforme({ status: "completed", completedAt: "2026-10-19T02:00:00.000Z" })]);
    const { container } = render(createElement(ClientAddendumConformePanel, { eventId: "evt_1", onlyWhenPending: true }));

    await waitFor(() => expect(list).toHaveBeenCalledWith("evt_1"));
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });
});
