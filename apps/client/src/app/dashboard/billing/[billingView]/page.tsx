import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

const billingViews: Record<string, ClientPortalView> = {
  quotations: "billing-quotations",
  invoices: "billing-invoices",
  "payment-schedule": "billing-payment-schedule",
  "payment-reminders": "dashboard-payment-reminders",
  receipts: "billing-receipts",
  balance: "billing-balance",
};

type Props = { params: Promise<{ billingView: string }> };

export default async function ClientDashboardBillingViewPage({ params }: Props) {
  const { billingView } = await params;
  const portalView = billingViews[billingView];
  if (!portalView) notFound();
  return <ClientDashboardWorkspaceView route="billing" portalView={portalView} />;
}