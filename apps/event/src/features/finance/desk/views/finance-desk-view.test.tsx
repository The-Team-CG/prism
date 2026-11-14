/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import { PRISM_SESSION_STORAGE_KEYS, type PrismFinanceDesk, type PrismFinanceDeskItem } from "@prism/types";

const { verify, remind, toast } = vi.hoisted(() => ({
  verify: vi.fn(),
  remind: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const deskFetch = vi.hoisted(() => vi.fn());

vi.mock("../data/finance-desk-resource", () => ({ financeDesk: { name: "finance.desk", staleMs: 15_000, fetch: deskFetch } }));
vi.mock("../data/finance-desk-commands", async (original) => ({ ...(await original<object>()), financeDeskCommands: { verify, remind } }));
vi.mock("@/app/lib/session", () => ({ readStoredEventSession: () => ({ id: "usr_mys" }) }));
vi.mock("@prism/ui/components/sonner", () => ({ toast }));

import { FinanceDeskView } from "./finance-desk-view";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

const item = (overrides: Partial<PrismFinanceDeskItem>): PrismFinanceDeskItem => ({
  id: "i", kind: "verify_payment", severity: "warning", eventId: "evt_1", eventName: "Ayala Gala", title: "Check ₱60,000 GCash payment", detail: "Reported by the client",
  amount: 60000, date: null, href: "/dashboard/finance/receipts", arrivedAt: null, ...overrides,
});

function desk(queue: PrismFinanceDeskItem[]): PrismFinanceDesk {
  return {
    generatedAt: "2026-11-15T00:00:00.000Z",
    totals: { clientOverdue: 0, clientDueSoon: 0, toVerify: 0, toVerifyCount: 0, unapplied: 0, supplierOverdue: 0, supplierDueSoon: 0, openDisputes: 0, pendingCorrections: 0 },
    queue, events: [], payouts: [],
  };
}

function renderDesk(queue: PrismFinanceDeskItem[]) {
  deskFetch.mockResolvedValue(desk(queue));
  render(<PortalQueryProvider actorKey="mys@pmcm.test"><FinanceDeskView /></PortalQueryProvider>);
}

describe("finance desk queue", () => {
  it("verifies several client payments with one note, and says which could not be verified", async () => {
    verify.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Already verified"));
    renderDesk([
      item({ id: "a", receiptId: "rcp_a", eventName: "Ayala Gala" }),
      item({ id: "b", receiptId: "rcp_b", eventName: "Globe Summit", amount: 40000 }),
      item({ id: "c", kind: "dispute", title: "Answer a dispute" }),
    ]);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select every payment to verify" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify 2" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Total ₱100,000")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Verify 2" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Say what was checked");
    expect(verify).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("What you checked"), { target: { value: "Matched the BPI statement" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Verify 2" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("One payment could not be verified. Open it to see why."));
    expect(verify.mock.calls).toEqual([["rcp_a", { notes: "Matched the BPI statement" }], ["rcp_b", { notes: "Matched the BPI statement" }]]);
    expect(toast.success).toHaveBeenCalledWith("Payment verified. The client has been told.");
  });

  it("reminds a late client in place, and narrows the queue by kind and search", async () => {
    remind.mockResolvedValue({ milestoneId: "m_late", remindedOn: "2026-11-15", alreadySentToday: false });
    renderDesk([
      item({ id: "late", kind: "client_overdue", severity: "critical", title: "₱66,000 overdue", milestoneId: "m_late", eventName: "Ayala Gala" }),
      item({ id: "pay", kind: "supplier_overdue", title: "Pay Bloom Florals", eventName: "Globe Summit" }),
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Remind" }));
    await waitFor(() => expect(remind).toHaveBeenCalledWith("evt_1", "m_late"));
    expect(toast.success).toHaveBeenCalledWith("Reminder sent to the client of Ayala Gala.");

    fireEvent.click(screen.getByRole("button", { name: /^Suppliers/ }));
    expect(screen.queryByText("₱66,000 overdue")).toBeNull();
    expect(screen.getByText("Pay Bloom Florals")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the queue" }), { target: { value: "ayala" } });
    expect(screen.getByText("₱66,000 overdue")).toBeTruthy();
    expect(screen.queryByText("Pay Bloom Florals")).toBeNull();
  });

  it("marks work that arrived since this person's last visit, and records this visit", async () => {
    localStorage.setItem(PRISM_SESSION_STORAGE_KEYS.pmcmFinanceLastSeen, JSON.stringify({ usr_mys: "2026-11-14T00:00:00.000Z" }));
    renderDesk([
      item({ id: "fresh", receiptId: "rcp_1", title: "Check ₱60,000 GCash payment", arrivedAt: "2026-11-14T03:00:00.000Z" }),
      item({ id: "old", kind: "dispute", title: "Answer a dispute", arrivedAt: "2026-11-10T03:00:00.000Z" }),
    ]);

    const fresh = (await screen.findByText("Check ₱60,000 GCash payment")).closest("li") as HTMLElement;
    expect(within(fresh).getByText("New")).toBeTruthy();
    expect(within(screen.getByText("Answer a dispute").closest("li") as HTMLElement).queryByText("New")).toBeNull();
    const stored = JSON.parse(localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.pmcmFinanceLastSeen) ?? "{}") as Record<string, string>;
    expect(stored.usr_mys > "2026-11-14T00:00:00.000Z").toBe(true);
  });
});
