import { eventGamesGuestRepository } from "../../data/event-games-guest-repository";

export function getPublicEventGameLobby(eventSlug: string) {
  return eventGamesGuestRepository.getPublicLobby(eventSlug);
}

export function startIndependentSingleplayerGame(eventSlug: string, gameId: string) {
  return eventGamesGuestRepository.startIndependentGame(eventSlug, gameId);
}

export function readEventGameParticipantSession() {
  return eventGamesGuestRepository.readParticipantSession();
}

export function leaveEventGamesFromLobby() {
  eventGamesGuestRepository.clearParticipantSession();
}
