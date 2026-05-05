import { notFound } from "next/navigation";
import { Dashboard, type ClientPortalView } from "@/app/components/dashboard/Dashboard";

const fileViews: Record<string, ClientPortalView> = {
  contracts: "files-contracts",
  quotations: "files-quotations",
  "invoices-receipts": "files-invoices-receipts",
  "event-layouts": "files-event-layouts",
  uploaded: "files-uploaded",
  shared: "files-shared",
};

type ClientDashboardFileViewPageProps = {
  params: Promise<{ fileView: string }>;
};

export default async function ClientDashboardFileViewPage({ params }: ClientDashboardFileViewPageProps) {
  const { fileView } = await params;
  const portalView = fileViews[fileView];

  if (!portalView) {
    notFound();
  }

  return <Dashboard route="files" portalView={portalView} />;
}
