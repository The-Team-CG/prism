import { GuestEventInfoView } from "@/features/guest-event/info";

export default function GuestEventInfoPage({
  params,
}: {
  params: Promise<{ accessCode: string }>;
}) {
  return <GuestEventInfoView params={params} />;
}
