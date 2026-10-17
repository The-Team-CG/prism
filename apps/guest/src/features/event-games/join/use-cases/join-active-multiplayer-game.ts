import { eventGamesGuestRepository } from "../../data/event-games-guest-repository";

export function joinActiveMultiplayerGame(pin: string, expectedEventSlug?: string) {
  return eventGamesGuestRepository.joinActiveGameByPin(pin, expectedEventSlug);
}

export function readCurrentGameParticipantSession() {
  return eventGamesGuestRepository.readParticipantSession();
}

export function leaveEventGamesOnThisDevice() {
  eventGamesGuestRepository.clearParticipantSession();
}
