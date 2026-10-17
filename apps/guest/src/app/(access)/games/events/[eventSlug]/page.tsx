import { EventGameLobbyView } from "@/features/event-games/lobby/views/event-game-lobby-view";

export default async function EventGameLobbyPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  return <EventGameLobbyView eventSlug={eventSlug} />;
}
