import type { PrismSubmitEventGameActionInput } from "@prism/types";
import { eventGamesGuestRepository } from "../../data/event-games-guest-repository";

export function getEventGameParticipantState(sessionId: string) {
  return eventGamesGuestRepository.getParticipantState(sessionId);
}

export function submitEventGameParticipantAction(sessionId: string, action: PrismSubmitEventGameActionInput) {
  return eventGamesGuestRepository.submitParticipantAction(sessionId, action);
}

export function getEventGameParticipantMediaAuthorization(sessionId: string, mediaObjectId: string) {
  return eventGamesGuestRepository.getParticipantMediaAuthorization(sessionId, mediaObjectId);
}

export function readEventGameParticipantSession() {
  return eventGamesGuestRepository.readParticipantSession();
}

export function leaveEventGamesFromSession() {
  eventGamesGuestRepository.clearParticipantSession();
}
