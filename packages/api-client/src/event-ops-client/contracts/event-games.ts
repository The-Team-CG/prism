import type {
  PrismCreateEventGameInput,
  PrismCreateGameSessionInput,
  PrismEventGameDefinition,
  PrismGameHostCommandResult,
  PrismGameHostSession,
  PrismGameHostState,
  PrismEventGameAnalytics,
  PrismEventGameMediaAuthorization,
  PrismGameHostCommandInput,
  PrismUpdateEventGameInput,
  PrismEventGameLobby,
  PrismIndependentGameSessionStart,
  PrismJoinActiveMultiplayerGameInput,
  PrismJoinedMultiplayerGameSession,
  PrismStartIndependentSingleplayerGameInput,
  PrismGamePublicState,
  PrismSubmitEventGameActionInput,
  PrismGameSessionResponsePage,
  PrismEventGameAward,
  PrismEventGameHostLobbyBranding,
  PrismEventGameLobbyLogoUploadTicket,
  PrismEventGameMediaUploadTicket,
  PrismAssignEventGameAwardInput,
  PrismModerateEventGameInput,
  UpdateEventGameLobbyBrandingInput,
  RequestEventGameLobbyLogoUploadInput,
  RequestEventGameMediaUploadInput,
  ConfirmStorageUploadInput,
} from "@prism/types";

/** Organizer operations use verified bearer identity; actor identity is not a query parameter. */
export interface EventOpsEventGamesContract {
  eventGames: {
    listForEvent(eventId: string): Promise<PrismEventGameDefinition[]>;
    createDraft(eventId: string, input: PrismCreateEventGameInput): Promise<PrismEventGameDefinition>;
    getForEvent(eventId: string, gameId: string): Promise<PrismEventGameDefinition>;
    updateDraft(eventId: string, gameId: string, input: PrismUpdateEventGameInput): Promise<PrismEventGameDefinition>;
    removeUnstartedGame(eventId: string, gameId: string): Promise<PrismEventGameDefinition>;
    publishDraft(eventId: string, gameId: string): Promise<PrismEventGameDefinition>;
    createHostSession(eventId: string, gameId: string, input: PrismCreateGameSessionInput): Promise<PrismGameHostSession>;
    executeHostCommand(eventId: string, sessionId: string, input: PrismGameHostCommandInput): Promise<PrismGameHostCommandResult>;
    getHostState(eventId: string, sessionId: string): Promise<PrismGameHostState>;
    getEventAnalytics(eventId: string): Promise<PrismEventGameAnalytics>;
    ensureLobby(eventId: string): Promise<{ eventSlug: string }>;
    getLobbyBranding(eventId: string): Promise<PrismEventGameHostLobbyBranding>;
    updateLobbyBranding(eventId: string, input: UpdateEventGameLobbyBrandingInput): Promise<PrismEventGameHostLobbyBranding>;
    requestLobbyLogoUpload(eventId: string, input: RequestEventGameLobbyLogoUploadInput): Promise<PrismEventGameLobbyLogoUploadTicket>;
    confirmLobbyLogoUpload(eventId: string, objectId: string, input: ConfirmStorageUploadInput): Promise<{ objectId: string }>;
    requestGameMediaUpload(eventId: string, gameId: string, input: RequestEventGameMediaUploadInput): Promise<PrismEventGameMediaUploadTicket>;
    confirmGameMediaUpload(eventId: string, gameId: string, objectId: string, input: ConfirmStorageUploadInput): Promise<{ objectId: string }>;
    getPublicLobby(eventSlug: string): Promise<PrismEventGameLobby>;
    startIndependentSingleplayerGameSession(
      eventSlug: string,
      gameId: string,
      input: PrismStartIndependentSingleplayerGameInput,
    ): Promise<PrismIndependentGameSessionStart>;
    joinActiveMultiplayerGameSession(
      input: PrismJoinActiveMultiplayerGameInput,
      retainedCredential?: string,
    ): Promise<PrismJoinedMultiplayerGameSession>;
    submitAction(
      sessionId: string,
      input: PrismSubmitEventGameActionInput,
      participantCredential: string,
    ): Promise<PrismGamePublicState>;
    getParticipantState(sessionId: string, participantCredential: string): Promise<PrismGamePublicState>;
    getParticipantMediaAuthorization(
      sessionId: string,
      objectId: string,
      participantCredential: string,
    ): Promise<PrismEventGameMediaAuthorization>;
    moderate(
      eventId: string,
      sessionId: string,
      input: PrismModerateEventGameInput,
    ): Promise<{ id: string; targetId: string; afterStatus: string }>;
    assignAward(
      eventId: string,
      sessionId: string,
      input: PrismAssignEventGameAwardInput,
    ): Promise<PrismEventGameAward>;
    getResponseHistory(
      eventId: string,
      sessionId: string,
      pagination?: { limit?: number; cursor?: string },
    ): Promise<PrismGameSessionResponsePage>;
  };
}
