import type { PrismBillingStatement, PrismPaymentMilestone } from "@prism/types";

export function clientBillingSummary(
  payments: PrismPaymentMilestone[],
  billing?: Pick<PrismBillingStatement, "totalAmount">,
) {
  const activePayments = payments.filter((payment) => !payment.supersededAt);
  const totalPaid = activePayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  const balance = activePayments.reduce((sum, payment) => sum + payment.remainingBalance, 0);
  const totalAmount = billing?.totalAmount ?? totalPaid + balance;

  return { totalAmount, totalPaid, balance };
}

export function clientMilestoneRemaining(payment: {
  amount: number;
  amountPaid?: number;
  remainingBalance?: number;
}) {
  if (typeof payment.remainingBalance === "number") return payment.remainingBalance;
  return Math.max(0, payment.amount - (payment.amountPaid ?? 0));
}

export function clientMilestoneFollowUpCopy(remaining: number) {
  if (remaining <= 0) return "This milestone is settled.";
  return "Remaining balance is still due. Partial payments stay on record until this milestone is paid in full.";
}

export type PortalBillingRow = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  /** Milestone or statement amount; for balances, what is still owed. */
  amount: number;
  date: string | null;
  status: string;
};

type PortalBillingSource = {
  events: Array<{ id: string; eventName: string }>;
  payments: PortalBillingPaymentSource[];
  statements: Array<Pick<PrismBillingStatement, "eventId" | "number" | "status" | "totalAmount" | "eventDate">>;
};

type PortalBillingPaymentSource = Pick<PrismPaymentMilestone, "id" | "eventId" | "label" | "amount" | "amountPaid" | "remainingBalance" | "dueDate" | "status" | "supersededAt" | "history">;

const PORTAL_BILLING_VIEWS_WITH_ROWS = new Set<string>([
  "billing-quotations",
  "billing-invoices",
  "billing-payment-schedule",
  "dashboard-payment-reminders",
  "billing-receipts",
  "billing-balance",
]);

/**
 * The account-level billing views, one list per view across the client's events. Returns null for the
 * overview, which shows the summary and the event picker instead.
 */
export function portalBillingRows(view: string | undefined, source: PortalBillingSource): PortalBillingRow[] | null {
  if (!view || !PORTAL_BILLING_VIEWS_WITH_ROWS.has(view)) return null;
  const eventName = new Map(source.events.map((event) => [event.id, event.eventName]));
  const active = source.payments.filter((payment) => eventName.has(payment.eventId) && !payment.supersededAt);
  const byDueDate = (a: { date: string | null }, b: { date: string | null }) => (a.date ?? "").localeCompare(b.date ?? "");

  if (view === "billing-quotations" || view === "billing-invoices") {
    return source.statements
      .filter((statement) => eventName.has(statement.eventId))
      .map((statement) => ({
        id: `statement-${statement.number}`,
        eventId: statement.eventId,
        eventName: eventName.get(statement.eventId) ?? "",
        title: `Statement ${statement.number}`,
        amount: statement.totalAmount,
        date: statement.eventDate ?? null,
        status: statement.status,
      }))
      .sort(byDueDate);
  }

  if (view === "billing-payment-schedule") {
    return active
      .map((payment) => ({
        id: payment.id,
        eventId: payment.eventId,
        eventName: eventName.get(payment.eventId) ?? "",
        title: payment.label,
        amount: payment.amount,
        date: payment.dueDate,
        status: payment.status,
      }))
      .sort(byDueDate);
  }

  if (view === "dashboard-payment-reminders") {
    return active
      .filter((payment) => payment.status !== "paid")
      .map((payment) => ({
        id: payment.id,
        eventId: payment.eventId,
        eventName: eventName.get(payment.eventId) ?? "",
        title: payment.label,
        amount: clientMilestoneRemaining(payment),
        date: payment.dueDate,
        status: payment.status,
      }))
      .sort(byDueDate);
  }

  if (view === "billing-receipts") {
    return active
      .flatMap((payment) =>
        payment.history.map((record) => ({
          id: record.id,
          eventId: payment.eventId,
          eventName: eventName.get(payment.eventId) ?? "",
          title: `${payment.label} received`,
          amount: record.amountReceived,
          date: record.paymentDate,
          status: "received",
        })),
      )
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }

  // billing-balance: one line per event, with what is still owed on its open milestones.
  return source.events.map((event) => {
    const owed = active
      .filter((payment) => payment.eventId === event.id && payment.status !== "paid")
      .reduce((sum, payment) => sum + clientMilestoneRemaining(payment), 0);
    return {
      id: `balance-${event.id}`,
      eventId: event.id,
      eventName: event.eventName,
      title: event.eventName,
      amount: owed,
      date: null,
      status: owed > 0 ? "balance due" : "settled",
    };
  });
}
