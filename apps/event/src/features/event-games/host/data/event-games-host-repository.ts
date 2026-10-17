import type {
  PrismAssignEventGameAwardInput,
  PrismCreateEventGameInput,
  PrismCreateGameSessionInput,
  PrismEventGameAnalytics,
  PrismEventGameDefinition,
  PrismEventGameHostLobbyBranding,
  PrismEventGameLobbyLogoUploadTicket,
  PrismEventGameMediaUploadTicket,
  PrismGameHostCommandInput,
  PrismGameHostCommandResult,
  PrismGameHostState,
  PrismGameSessionResponsePage,
  PrismModerateEventGameInput,
  PrismUpdateEventGameInput,
  UpdateEventGameLobbyBrandingInput,
  RequestEventGameLobbyLogoUploadInput,
  RequestEventGameMediaUploadInput,
  ConfirmStorageUploadInput,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const eventGamesHostRepository = {
  listForEvent(eventId: string): Promise<PrismEventGameDefinition[]> {
    return eventApi.eventGames.listForEvent(eventId);
  },
  createDraft(eventId: string, input: PrismCreateEventGameInput): Promise<PrismEventGameDefinition> {
    return eventApi.eventGames.createDraft(eventId, input);
  },
  updateDraft(eventId: string, gameId: string, input: PrismUpdateEventGameInput): Promise<PrismEventGameDefinition> {
    return eventApi.eventGames.updateDraft(eventId, gameId, input);
  },
  archiveGame(eventId: string, gameId: string): Promise<PrismEventGameDefinition> {
    return eventApi.eventGames.removeUnstartedGame(eventId, gameId);
  },
  publishDraft(eventId: string, gameId: string): Promise<PrismEventGameDefinition> {
    return eventApi.eventGames.publishDraft(eventId, gameId);
  },
  createHostSession(eventId: string, gameId: string, input: PrismCreateGameSessionInput) {
    return eventApi.eventGames.createHostSession(eventId, gameId, input);
  },
  executeHostCommand(
    eventId: string,
    sessionId: string,
    input: PrismGameHostCommandInput,
  ): Promise<PrismGameHostCommandResult> {
    return eventApi.eventGames.executeHostCommand(eventId, sessionId, input);
  },
  getHostState(eventId: string, sessionId: string): Promise<PrismGameHostState> {
    return eventApi.eventGames.getHostState(eventId, sessionId);
  },
  getAnalytics(eventId: string): Promise<PrismEventGameAnalytics> {
    return eventApi.eventGames.getEventAnalytics(eventId);
  },
  ensureLobby(eventId: string): Promise<{ eventSlug: string }> {
    return eventApi.eventGames.ensureLobby(eventId);
  },
  getLobbyBranding(eventId: string): Promise<PrismEventGameHostLobbyBranding> {
    return eventApi.eventGames.getLobbyBranding(eventId);
  },
  updateLobbyBranding(eventId: string, input: UpdateEventGameLobbyBrandingInput): Promise<PrismEventGameHostLobbyBranding> {
    return eventApi.eventGames.updateLobbyBranding(eventId, input);
  },
  requestLobbyLogoUpload(eventId: string, input: RequestEventGameLobbyLogoUploadInput): Promise<PrismEventGameLobbyLogoUploadTicket> {
    return eventApi.eventGames.requestLobbyLogoUpload(eventId, input);
  },
  confirmLobbyLogoUpload(eventId: string, objectId: string, input: ConfirmStorageUploadInput): Promise<{ objectId: string }> {
    return eventApi.eventGames.confirmLobbyLogoUpload(eventId, objectId, input);
  },
  requestGameMediaUpload(eventId: string, gameId: string, input: RequestEventGameMediaUploadInput): Promise<PrismEventGameMediaUploadTicket> {
    return eventApi.eventGames.requestGameMediaUpload(eventId, gameId, input);
  },
  confirmGameMediaUpload(eventId: string, gameId: string, objectId: string, input: ConfirmStorageUploadInput): Promise<{ objectId: string }> {
    return eventApi.eventGames.confirmGameMediaUpload(eventId, gameId, objectId, input);
  },
  getResponseHistory(
    eventId: string,
    sessionId: string,
    pagination: { cursor?: string; limit?: number },
  ): Promise<PrismGameSessionResponsePage> {
    return eventApi.eventGames.getResponseHistory(eventId, sessionId, pagination);
  },
  moderate(
    eventId: string,
    sessionId: string,
    input: PrismModerateEventGameInput,
  ) {
    return eventApi.eventGames.moderate(eventId, sessionId, input);
  },
  assignAward(
    eventId: string,
    sessionId: string,
    input: PrismAssignEventGameAwardInput,
  ) {
    return eventApi.eventGames.assignAward(eventId, sessionId, input);
  },
};

export type EventGamesHostRepository = typeof eventGamesHostRepository;
