/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismSupplierApplication } from "@prism/types";
import { SupplierApplicationsInboxView } from "./supplier-applications-inbox-view";

const repo = vi.hoisted(() => ({ listInbox: vi.fn(), review: vi.fn() }));
vi.mock("../data/supplier-applications-repository", () => ({ supplierApplicationsRepository: repo }));

afterEach(cleanup);

const applications = [
  { id: "app_1", companyName: "Alpha Events", contactName: "Ana", email: "ana@alpha.test", status: "new" },
  { id: "app_2", companyName: "Beta Lights", contactName: "Ben", email: "ben@beta.test", status: "new" },
] as unknown as PrismSupplierApplication[];

beforeEach(() => {
  repo.listInbox.mockResolvedValue(applications);
  repo.review.mockResolvedValue({});
});

describe("SupplierApplicationsInboxView decline", () => {
  it("opens the decline reason only on the application being declined, and sends it on confirm", async () => {
    render(<SupplierApplicationsInboxView />);
    await screen.findByText("Alpha Events");
    expect(screen.queryByLabelText(/Decline reason/)).toBeNull();
    expect(screen.getByText(/Applicants never see your review notes./)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[0]);
    expect(screen.getAllByLabelText(/Decline reason/)).toHaveLength(1);
    const reason = screen.getByLabelText("Decline reason for Alpha Events");

    const confirm = screen.getByRole("button", { name: "Confirm decline" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(reason, { target: { value: "Outside our service area" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(repo.review).toHaveBeenCalledWith("app_1", { action: "decline", declineReason: "Outside our service area" }));
  });
});
