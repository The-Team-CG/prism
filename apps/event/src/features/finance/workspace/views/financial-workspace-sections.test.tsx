/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismBillingStatement, PrismEvent, PrismPaymentMilestone } from "@prism/types";
import { BillingStatementCard, PaymentTracker } from "./financial-workspace-sections";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T04:00:00.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const balance: PrismPaymentMilestone = {
  id: "pay_sample_final", eventId: "evt_sample_ayala", label: "Balance", percentage: 50, amount: 260000,
  amountPaid: 0, remainingBalance: 260000, dueDate: "2026-06-11", status: "pending", history: [],
};
const downpayment: PrismPaymentMilestone = {
  id: "pay_sample_reservation", eventId: "evt_sample_ayala", label: "Downpayment", percentage: 50, amount: 260000,
  amountPaid: 260000, remainingBalance: 0, dueDate: "2026-04-29", status: "paid", history: [],
};

describe("PaymentTracker overdue milestones", () => {
  it("names how long a milestone is overdue, lists milestones by due date, and formats the date", () => {
    render(<PaymentTracker payments={[balance, downpayment]} busy={false} onRecord={vi.fn()} onMarkPayment={vi.fn()} />);

    expect(screen.getByText("Overdue by 144 days")).toBeTruthy();
    expect(screen.getByText(/Due (Jun 11, 2026|11 Jun 2026)/)).toBeTruthy();
    expect(screen.queryByText(/2026-06-11/)).toBeNull();

    const text = document.body.textContent ?? "";
    expect(text.indexOf("Downpayment")).toBeLessThan(text.indexOf("Balance"));
  });

  it("does not flag a paid milestone as overdue", () => {
    render(<PaymentTracker payments={[downpayment]} busy={false} onRecord={vi.fn()} onMarkPayment={vi.fn()} />);

    expect(screen.queryByText(/Overdue by/)).toBeNull();
  });
});

describe("BillingStatementCard PDF availability", () => {
  const event = {
    id: "evt_sample_ayala", inquiryId: "inq_1", clientName: "Ana Reyes", eventName: "Ayala Tech Summit 2026",
    eventDate: "2026-06-18", status: "briefing", clientPortalStatus: "unlocked", readiness: "ready", archived: false,
    floorPlanStatus: "approved",
  } satisfies PrismEvent;
  const statement = {
    id: "bill_sample_ayala", eventId: "evt_sample_ayala", number: "BS-2026-0001", clientName: "Ana Reyes",
    clientContact: "ana@ayala.test", eventName: "Ayala Tech Summit 2026", eventDate: "2026-06-18",
    lineItems: [{ label: "Approved event package", amount: 520000 }], paymentSchedule: [], paymentMethods: [],
    totalAmount: 520000, pdfUrl: "", status: "issued", generatedAt: "2026-05-01T00:00:00.000Z", storageState: "pending",
  } satisfies PrismBillingStatement;

  it("disables Download PDF and says plainly when the PDF is not stored yet", () => {
    render(
      <BillingStatementCard event={event} statement={statement} billingStatementHref={undefined} busy={false} onSendBilling={vi.fn()} />,
    );

    const download = screen.getByRole("button", { name: /Download PDF/ }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    expect(screen.queryByRole("link", { name: /Download PDF/ })).toBeNull();
    expect(screen.getByText("The PDF isn't ready yet. The details below are on record.")).toBeTruthy();
    expect(screen.queryByText(/W10/)).toBeNull();
    expect(screen.getByText(/(Jun 18, 2026|18 Jun 2026)/)).toBeTruthy();
  });
});
