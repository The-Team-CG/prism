import { notFound } from "next/navigation";
import { Dashboard, type ClientPortalView } from "@/app/components/dashboard/Dashboard";

const approvalViews: Record<string, ClientPortalView> = {
  pending: "approvals-pending",
  approved: "approvals-approved",
  "needs-revision": "approvals-needs-revision",
  contracts: "approvals-contracts",
  quotations: "approvals-quotations",
  "final-confirmation": "approvals-final-confirmation",
};

type ClientDashboardApprovalViewPageProps = {
  params: Promise<{ approvalView: string }>;
};

export default async function ClientDashboardApprovalViewPage({ params }: ClientDashboardApprovalViewPageProps) {
  const { approvalView } = await params;
  const portalView = approvalViews[approvalView];

  if (!portalView) {
    notFound();
  }

  return <Dashboard route="approvals" portalView={portalView} />;
}
