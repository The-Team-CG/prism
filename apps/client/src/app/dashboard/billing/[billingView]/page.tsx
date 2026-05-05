import { notFound } from "next/navigation";
import { Dashboard, type ClientPortalView } from "@/app/components/dashboard/Dashboard";

const billingViews: Record<string, ClientPortalView> = {
  quotations: "billing-quotations",
  invoices: "billing-invoices",
  "payment-schedule": "billing-payment-schedule",
  "payment-reminders": "dashboard-payment-reminders",
  receipts: "billing-receipts",
  balance: "billing-balance",
};

type ClientDashboardBillingViewPageProps = {
  params: Promise<{ billingView: string }>;
};

export default async function ClientDashboardBillingViewPage({ params }: ClientDashboardBillingViewPageProps) {
  const { billingView } = await params;
  const portalView = billingViews[billingView];

  if (!portalView) {
    notFound();
  }

  return <Dashboard route="billing" portalView={portalView} />;
}
