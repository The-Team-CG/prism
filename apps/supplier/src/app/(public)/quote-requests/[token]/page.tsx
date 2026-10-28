import { SupplierQuoteLinkView } from "@/features/supplier-quote-link/views/supplier-quote-link-view";

export default async function SupplierQuoteLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SupplierQuoteLinkView token={token} />;
}
