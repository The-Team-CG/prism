import { EventGamePlayView } from "@/features/event-games/play/views/event-game-play-view";

export default async function EventGameSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <EventGamePlayView sessionId={sessionId} />;
}
