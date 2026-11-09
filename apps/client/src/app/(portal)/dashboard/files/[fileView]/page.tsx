import { notFound, redirect } from "next/navigation";
import { ClientDashboardWorkspaceView, type ClientPortalView } from "@/features/client-dashboard/workspace";

/** Each file route names the records it shows. Uploaded and shared have no record field that answers them, so they land on All. */
const fileViews: Record<string, ClientPortalView> = {
  contracts: "files-contracts",
  quotations: "files-quotations",
  "invoices-receipts": "files-invoices-receipts",
  "event-layouts": "files-event-layouts",
};

const unfilteredFileViews = new Set(["uploaded", "shared"]);

type Props = { params: Promise<{ fileView: string }> };

export default async function ClientDashboardFileViewPage({ params }: Props) {
  const { fileView } = await params;
  const portalView = fileViews[fileView];
  if (!portalView) {
    if (unfilteredFileViews.has(fileView)) redirect("/dashboard/files");
    notFound();
  }
  return <ClientDashboardWorkspaceView route="files" portalView={portalView} />;
}
