import { notFound, redirect } from "next/navigation";

/** Billing is one page now. The old per-view links (statements, schedule, reminders, receipts, balance) still land on it. */
const FORMER_BILLING_VIEWS = new Set(["statements", "payment-schedule", "payment-reminders", "receipts", "balance"]);

type Props = { params: Promise<{ billingView: string }> };

export default async function ClientDashboardBillingViewPage({ params }: Props) {
  const { billingView } = await params;
  if (!FORMER_BILLING_VIEWS.has(billingView)) notFound();
  redirect("/dashboard/billing");
}
