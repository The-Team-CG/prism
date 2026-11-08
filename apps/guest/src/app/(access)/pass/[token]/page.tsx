import { GuestPassView } from "@/features/guest-pass/views/guest-pass-view";

export default async function GuestPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestPassView token={token} />;
}
