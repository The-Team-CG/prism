import { GuestEventInfoView } from "@/features/guest-event/info";

export default async function GuestEventInfoPage({
  params,
}: {
  params: Promise<{ accessCode: string }>;
}) {
  const { accessCode } = await params;
  return <GuestEventInfoView accessCode={accessCode} />;
}
