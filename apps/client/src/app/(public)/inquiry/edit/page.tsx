import { InquiryEditView } from "@/features/inquiry/edit/views/inquiry-edit-view";

export default async function InquiryEditPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <InquiryEditView token={Array.isArray(token) ? token[0] ?? "" : token ?? ""} />;
}
