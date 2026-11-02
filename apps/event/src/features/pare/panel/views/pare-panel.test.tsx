/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PrismSupplierQuoteRequest } from "@prism/types";
import { PAREPanel } from "./pare-panel";

const { onWithdraw } = vi.hoisted(() => ({ onWithdraw: vi.fn(async () => undefined) }));

vi.mock("../view-models/use-pare-panel-view-model", () => ({
  useParePanelViewModel: () => ({
    eventApprovals: [],
    loading: false,
    actionBusy: false,
    withdrawingId: null,
    error: null,
    fetchApprovals: vi.fn(),
    handleWithdraw: onWithdraw,
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  onWithdraw.mockClear();
});

const assigned: PrismSupplierQuoteRequest = {
  id: "qr_harvest",
  eventId: "evt_1",
  supplierId: "sup_harvest",
  supplierName: "Harvest Table Catering",
  category: "Food and Beverages",
  message: "",
  accessToken: "token",
  confidentialBid: false,
  status: "selected",
  assignmentStatus: "confirmed",
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("PAREPanel withdrawal", () => {
  it("asks for confirmation with the consequence before withdrawing an assigned supplier", () => {
    render(<PAREPanel eventId="evt_1" assignedRequests={[assigned]} suppliers={[]} onWithdraw={onWithdraw} busy={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Withdraw and find a replacement" }));

    expect(onWithdraw).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alert");
    expect(confirm.textContent).toContain("Withdraw Harvest Table Catering from the event?");
    expect(confirm.textContent).toContain("supplier portal access is revoked");
    expect(confirm.textContent).toContain("Nothing is confirmed until you approve it");
  });

  it("keeps the supplier assigned when the confirmation is cancelled", () => {
    render(<PAREPanel eventId="evt_1" assignedRequests={[assigned]} suppliers={[]} onWithdraw={onWithdraw} busy={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Withdraw and find a replacement" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep assigned" }));

    expect(onWithdraw).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("withdraws the chosen supplier only after the confirmation is accepted", () => {
    render(<PAREPanel eventId="evt_1" assignedRequests={[assigned]} suppliers={[]} onWithdraw={onWithdraw} busy={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Withdraw and find a replacement" }));
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Withdraw and find a replacement" }));

    expect(onWithdraw).toHaveBeenCalledWith("qr_harvest");
  });
});
