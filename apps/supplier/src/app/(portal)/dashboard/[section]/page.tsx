import { notFound } from "next/navigation";
import { SupplierWorkspaceView, isSupplierDashboardSection } from "@/features/supplier-dashboard/workspace";

export default async function SupplierDashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSupplierDashboardSection(section) || section === "dashboard") notFound();
  return <SupplierWorkspaceView section={section} />;
}
