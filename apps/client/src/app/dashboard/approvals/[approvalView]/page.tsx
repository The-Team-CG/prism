import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

const approvalViews: Record<string, ClientPortalView> = {
  pending: "approvals-pending",
  approved: "approvals-approved",
  "needs-revision": "approvals-needs-revision",
  contracts: "approvals-contracts",
  quotations: "approvals-quotations",
  "final-confirmation": "approvals-final-confirmation",
};

type Props = { params: Promise<{ approvalView: string }> };

export default async function ClientDashboardApprovalViewPage({ params }: Props) {
  const { approvalView } = await params;
  const portalView = approvalViews[approvalView];
  if (!portalView) notFound();
  return <ClientDashboardWorkspaceView route="approvals" portalView={portalView} />;
}