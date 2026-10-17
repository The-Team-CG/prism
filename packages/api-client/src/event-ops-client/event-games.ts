import type {
  PrismCreateEventGameInput,
  PrismCreateGameSessionInput,
  PrismEventGameDefinition,
  PrismGameHostCommandInput,
  PrismGameHostCommandResult,
  PrismGameHostSession,
  PrismGameHostState,
  PrismEventGameAnalytics,
  PrismEventGameMediaAuthorization,
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
import { joinedMultiplayerGameSessionSchema, parseContract } from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createEventGamesClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "eventGames"> {
  return {
    eventGames: {
      listForEvent: (eventId) =>
        prismRequest<PrismEventGameDefinition[]>(
          `/events/${encodeURIComponent(eventId)}/games`,
          withBase(options),
        ),
      createDraft: (eventId, input: PrismCreateEventGameInput) =>
        prismRequest<PrismEventGameDefinition>(
          `/events/${encodeURIComponent(eventId)}/games`,
          withBase(options, { method: "POST", body: input }),
        ),
      getForEvent: (eventId, gameId) =>
        prismRequest<PrismEventGameDefinition>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}`,
          withBase(options),
        ),
      updateDraft: (eventId, gameId, input: PrismUpdateEventGameInput) =>
        prismRequest<PrismEventGameDefinition>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      removeUnstartedGame: (eventId, gameId) =>
        prismRequest<PrismEventGameDefinition>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}`,
          withBase(options, { method: "DELETE" }),
        ),
      publishDraft: (eventId, gameId) =>
        prismRequest<PrismEventGameDefinition>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}/publish`,
          withBase(options, { method: "POST" }),
        ),
      createHostSession: (eventId, gameId, input: PrismCreateGameSessionInput) =>
        prismRequest<PrismGameHostSession>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}/sessions`,
          withBase(options, { method: "POST", body: input }),
        ),
      executeHostCommand: (eventId, sessionId, input: PrismGameHostCommandInput) =>
        prismRequest<PrismGameHostCommandResult>(
          `/events/${encodeURIComponent(eventId)}/game-sessions/${encodeURIComponent(sessionId)}/commands`,
          withBase(options, { method: "POST", body: input }),
        ),
      getHostState: (eventId, sessionId) =>
        prismRequest<PrismGameHostState>(
          `/events/${encodeURIComponent(eventId)}/game-sessions/${encodeURIComponent(sessionId)}/host-state`,
          withBase(options),
        ),
      getEventAnalytics: (eventId) =>
        prismRequest<PrismEventGameAnalytics>(
          `/events/${encodeURIComponent(eventId)}/game-analytics`,
          withBase(options),
        ),
      ensureLobby: (eventId) =>
        prismRequest<{ eventSlug: string }>(
          `/events/${encodeURIComponent(eventId)}/game-lobby`,
          withBase(options, { method: "POST" }),
        ),
      getLobbyBranding: (eventId) =>
        prismRequest<PrismEventGameHostLobbyBranding>(
          `/events/${encodeURIComponent(eventId)}/game-lobby/branding`,
          withBase(options),
        ),
      updateLobbyBranding: (eventId, input: UpdateEventGameLobbyBrandingInput) =>
        prismRequest<PrismEventGameHostLobbyBranding>(
          `/events/${encodeURIComponent(eventId)}/game-lobby/branding`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      requestLobbyLogoUpload: (eventId, input: RequestEventGameLobbyLogoUploadInput) =>
        prismRequest<PrismEventGameLobbyLogoUploadTicket>(
          `/events/${encodeURIComponent(eventId)}/game-lobby/branding/logo-upload-request`,
          withBase(options, { method: "POST", body: input }),
        ),
      confirmLobbyLogoUpload: (eventId, objectId, input: ConfirmStorageUploadInput) =>
        prismRequest<{ objectId: string }>(
          `/events/${encodeURIComponent(eventId)}/game-lobby/branding/logos/${encodeURIComponent(objectId)}/confirm`,
          withBase(options, { method: "POST", body: input }),
        ),
      requestGameMediaUpload: (eventId, gameId, input: RequestEventGameMediaUploadInput) =>
        prismRequest<PrismEventGameMediaUploadTicket>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}/media-upload-request`,
          withBase(options, { method: "POST", body: input }),
        ),
      confirmGameMediaUpload: (eventId, gameId, objectId, input: ConfirmStorageUploadInput) =>
        prismRequest<{ objectId: string }>(
          `/events/${encodeURIComponent(eventId)}/games/${encodeURIComponent(gameId)}/media/${encodeURIComponent(objectId)}/confirm`,
          withBase(options, { method: "POST", body: input }),
        ),
      getPublicLobby: (eventSlug) =>
        prismRequest<PrismEventGameLobby>(
          `/game-lobbies/${encodeURIComponent(eventSlug)}`,
          withBase(options),
        ),
      startIndependentSingleplayerGameSession: (eventSlug, gameId, input: PrismStartIndependentSingleplayerGameInput) =>
        prismRequest<PrismIndependentGameSessionStart>(
          `/game-lobbies/${encodeURIComponent(eventSlug)}/games/${encodeURIComponent(gameId)}/sessions`,
          withBase(options, { method: "POST", body: input }),
        ),
      joinActiveMultiplayerGameSession: (input: PrismJoinActiveMultiplayerGameInput, retainedCredential?) =>
        prismRequest<unknown>(
          "/game-sessions/join",
          withBase(options, {
            method: "POST",
            body: input,
            ...(retainedCredential ? { headers: { "x-prism-game-credential": retainedCredential } } : {}),
          }),
        ).then((response) => parseContract(
          joinedMultiplayerGameSessionSchema,
          response,
          "Game join response",
        )),
      submitAction: (sessionId, input: PrismSubmitEventGameActionInput, participantCredential) =>
        prismRequest<PrismGamePublicState>(
          `/game-sessions/${encodeURIComponent(sessionId)}/actions`,
          withBase(options, {
            method: "POST",
            body: input,
            headers: { "x-prism-game-credential": participantCredential },
          }),
        ),
      getParticipantState: (sessionId, participantCredential) =>
        prismRequest<PrismGamePublicState>(
          `/game-sessions/${encodeURIComponent(sessionId)}/state`,
          withBase(options, { headers: { "x-prism-game-credential": participantCredential } }),
        ),
      getParticipantMediaAuthorization: (sessionId, objectId, participantCredential) =>
        prismRequest<PrismEventGameMediaAuthorization>(
          `/game-sessions/${encodeURIComponent(sessionId)}/media/${encodeURIComponent(objectId)}/download-authorization`,
          withBase(options, { headers: { "x-prism-game-credential": participantCredential } }),
        ),
      moderate: (eventId, sessionId, input: PrismModerateEventGameInput) =>
        prismRequest<{ id: string; targetId: string; afterStatus: string }>(
          `/events/${encodeURIComponent(eventId)}/game-sessions/${encodeURIComponent(sessionId)}/moderation`,
          withBase(options, { method: "POST", body: input }),
        ),
      assignAward: (eventId, sessionId, input: PrismAssignEventGameAwardInput) =>
        prismRequest<PrismEventGameAward>(
          `/events/${encodeURIComponent(eventId)}/game-sessions/${encodeURIComponent(sessionId)}/awards`,
          withBase(options, { method: "POST", body: input }),
        ),
      getResponseHistory: (eventId, sessionId, pagination = {}) => {
        const path = `/events/${encodeURIComponent(eventId)}/game-sessions/${encodeURIComponent(sessionId)}/responses`;
        const query = toQueryString(pagination);
        return prismRequest<PrismGameSessionResponsePage>(
          query ? `${path}?${query}` : path,
          withBase(options),
        );
      },
    },
  };
}
