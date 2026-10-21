import { EventGamePinJoinView } from "@/features/event-games/join/views/event-game-pin-join-view";

export default async function JoinGamePage({
  searchParams,
}: {
  searchParams?: Promise<{ eventSlug?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  return <EventGamePinJoinView expectedEventSlug={query.eventSlug} />;
}
