/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import type { PrismFinanceDeskEvent, PrismPaymentMilestone, PrismPaymentReceipt, PrismStatementMilestone } from "@prism/types";
import { EventMoneyHero, EventPaymentSchedule } from "./event-money-views";

const historyFetch = vi.hoisted(() => vi.fn());
vi.mock("../data/finance-repository", () => ({ paymentHistory: { name: "finance.payment-history", staleMs: 10_000, fetch: historyFetch } }));

afterEach(cleanup);

const TODAY = "2026-11-14";

function milestone(overrides: Partial<PrismStatementMilestone>): PrismStatementMilestone {
  return { id: "m", label: "Balance", dueDate: "2026-12-30", amount: 100000, paid: 0, remaining: 100000, status: "pending", checking: 0, disputed: 0, settledOn: null, ...overrides };
}

function money(milestones: PrismStatementMilestone[], overrides: Partial<PrismFinanceDeskEvent> = {}): PrismFinanceDeskEvent {
  return {
    eventId: "evt", eventName: "Gala", eventDate: "2026-10-26", clientName: "Ana Reyes", statementNumber: "BS-1", statementSent: true,
    billed: 420000, paid: milestones.reduce((sum, item) => sum + item.paid, 0), checking: milestones.reduce((sum, item) => sum + item.checking, 0),
    balance: milestones.reduce((sum, item) => sum + item.remaining, 0), overdue: 0, milestones, ...overrides,
  };
}

const payment = (id: string, history: PrismPaymentMilestone["history"] = []): PrismPaymentMilestone => ({
  id, eventId: "evt", label: id, percentage: 50, amount: 0, amountPaid: 0, remainingBalance: 0, dueDate: TODAY, status: "pending", history,
});
const record = (id: string, receiptId: string, amountReceived: number) => ({ id, eventId: "evt", milestoneId: "x", amountReceived, paymentDate: "2026-11-10", paymentMethod: "GCash", referenceNumber: `REF-${id}`, recordedAt: "", receiptId });
const receipt = (id: string, status: PrismPaymentReceipt["status"]) => ({ id, status } as PrismPaymentReceipt);

describe("PMCM event billing", () => {
  it("leads with what is overdue and offers to send the statement again once it was sent", () => {
    const late = milestone({ id: "second", label: "Second payment", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, checking: 60000 });
    render(<EventMoneyHero money={money([late], { overdue: 66000 })} todayKey={TODAY} busy={false} onRecord={vi.fn()} onSend={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "₱66,000 overdue" })).toBeTruthy();
    expect(screen.getByText("₱60,000 to verify")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send again/ })).toBeTruthy();
    // No stored PDF, no download button.
    expect(screen.queryByRole("button", { name: /Statement PDF/ })).toBeNull();
  });

  it("says a statement the client cannot see yet has not been sent", () => {
    render(<EventMoneyHero money={money([milestone({})], { statementSent: false })} todayKey={TODAY} busy={false} onSend={vi.fn()} pdf={{ busy: false, download: vi.fn() }} />);

    expect(screen.getByRole("heading", { name: "Statement not sent" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send to client/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Statement PDF/ })).toBeTruthy();
  });

  it("shows each payment's money with whether it was verified, and actions (including a reminder once late) only for payments still open", () => {
    const remind = vi.fn();
    const steps = [
      milestone({ id: "dp", label: "Downpayment", dueDate: "2026-09-26", amount: 210000, paid: 210000, remaining: 0, settledOn: "2026-09-25" }),
      milestone({ id: "second", label: "Second payment", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, checking: 60000 }),
    ];
    render(
      <EventPaymentSchedule
        money={money(steps)}
        payments={[payment("dp", [record("r1", "prcp_ok", 210000)]), payment("second", [record("r2", "prcp_new", 60000)])]}
        receipts={[receipt("prcp_ok", "verified"), receipt("prcp_new", "recorded")]}
        todayKey={TODAY}
        busy={false}
        onRecord={vi.fn()}
        onToggleRisk={vi.fn()}
        reminder={{ busyId: null, remind }}
      />,
    );

    const [paid, late] = screen.getAllByRole("listitem").filter((item) => item.parentElement?.getAttribute("aria-label") === "Client payments");
    expect(within(paid).getByText("Verified")).toBeTruthy();
    expect(within(paid).queryByRole("button", { name: /Record payment/ })).toBeNull();
    expect(within(late).getByText("To verify")).toBeTruthy();
    expect(within(late).getByText(/26 days late/)).toBeTruthy();
    expect(within(late).getByRole("link", { name: "Open receipt" }).getAttribute("href")).toBe("/dashboard/finance/receipts?receipt=prcp_new");
    expect(within(late).getByRole("button", { name: /Record payment/ })).toBeTruthy();
    expect(within(paid).queryByRole("button", { name: /Remind client/ })).toBeNull();
    fireEvent.click(within(late).getByRole("button", { name: /Remind client/ }));
    expect(remind).toHaveBeenCalledWith("second", "second");
  });

  it("opens a payment's history, oldest first, with who did what and a way to the receipt", async () => {
    historyFetch.mockResolvedValue({
      milestoneId: "second", label: "Second payment", amount: 126000, paid: 60000, remaining: 66000, dueDate: "2026-10-19",
      entries: [
        { id: "s", kind: "scheduled", at: "2026-09-01T00:00:00.000Z", title: "₱126,000 scheduled", detail: "Due 2026-10-19.", by: null, amount: 126000 },
        { id: "rem", kind: "reminded", at: "2026-10-25T01:00:00.000Z", title: "Client reminded", detail: "A reminder notice went to the client.", by: "Ms. Mys", amount: null },
        { id: "rep", kind: "reported", at: "2026-11-14T01:00:00.000Z", title: "Client said they paid ₱66,000", detail: "Bank Transfer · Ref BPI-1", by: "Ana Reyes", amount: 66000, receiptId: "prcp_client" },
      ],
    });
    render(
      <PortalQueryProvider actorKey="mys@pmcm.test">
        <EventPaymentSchedule
          money={money([milestone({ id: "second", label: "Second payment", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000 })])}
          payments={[payment("second")]} receipts={[]} todayKey={TODAY} busy={false} onRecord={vi.fn()} onToggleRisk={vi.fn()}
        />
      </PortalQueryProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    const sheet = within(await screen.findByRole("dialog"));
    const entries = within(await sheet.findByRole("list", { name: "Payment history" })).getAllByRole("listitem");
    expect(entries.map((entry) => entry.querySelector("p")?.textContent)).toEqual(["₱126,000 scheduled", "Client reminded", "Client said they paid ₱66,000"]);
    expect(within(entries[1]).getByText(/Ms\. Mys/)).toBeTruthy();
    expect(within(entries[2]).getByRole("link", { name: "Open receipt" }).getAttribute("href")).toBe("/dashboard/finance/receipts?receipt=prcp_client");
    expect(historyFetch).toHaveBeenCalledWith({ eventId: "evt", milestoneId: "second" }, expect.anything());
  });
});
