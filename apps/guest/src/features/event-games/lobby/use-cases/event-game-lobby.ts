import { eventGamesGuestRepository } from "../../data/event-games-guest-repository";

export function getPublicEventGameLobby(eventSlug: string) {
  return eventGamesGuestRepository.getPublicLobby(eventSlug);
}

export function startIndependentSingleplayerGame(eventSlug: string, gameId: string) {
  return eventGamesGuestRepository.startIndependentGame(eventSlug, gameId);
}

export async function getResumableEventGame(eventId: string) {
  const stored = eventGamesGuestRepository.readParticipantSession();
  if (stored?.eventId !== eventId || !stored.currentSessionId) return null;
  const state = await eventGamesGuestRepository.getParticipantState(stored.currentSessionId).catch(() => null);
  if (!state || state.status === "completed" || state.status === "cancelled") return null;
  return { id: state.sessionId, title: state.game.title, alias: state.participant.participantAlias };
}

export function leaveEventGamesFromLobby() {
  eventGamesGuestRepository.clearParticipantSession();
}
