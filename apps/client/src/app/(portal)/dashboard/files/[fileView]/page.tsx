import { notFound, redirect } from "next/navigation";

const fileViews = new Set(["contracts", "quotations", "invoices-receipts", "event-layouts", "uploaded", "shared"]);

type Props = { params: Promise<{ fileView: string }> };

export default async function ClientDashboardFileViewPage({ params }: Props) {
  const { fileView } = await params;
  if (!fileViews.has(fileView)) notFound();
  redirect("/dashboard/files");
}
