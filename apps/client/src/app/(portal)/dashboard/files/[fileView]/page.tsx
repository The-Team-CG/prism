import { notFound } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

/** Each file route names the records it shows; All is the files page itself. */
const fileViews: Record<string, ClientPortalView> = {
  contracts: "files-contracts",
  quotations: "files-quotations",
  "invoices-receipts": "files-invoices-receipts",
  "event-layouts": "files-event-layouts",
};

type Props = { params: Promise<{ fileView: string }> };

export default async function ClientDashboardFileViewPage({ params }: Props) {
  const { fileView } = await params;
  const portalView = fileViews[fileView];
  if (!portalView) notFound();
  return <ClientDashboardWorkspaceView route="files" portalView={portalView} />;
}
