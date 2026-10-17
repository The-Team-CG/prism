"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PrismAssignEventGameAwardInput,
  PrismCreateEventGameInput,
  PrismEventGameAnalytics,
  PrismEventGameDefinition,
  PrismEventGameHostLobbyBranding,
  PrismGameHostCommandInput,
  PrismGameHostCommandResult,
  PrismGameHostState,
  PrismGameSessionResponse,
  PrismUpdateEventGameInput,
  PrismUserRole,
  UpdateEventGameLobbyBrandingInput,
} from "@prism/types";
import { PRISM_EVENT_GAME_BRAND_THEMES } from "@prism/types";
import { eventGamesHostActions } from "../use-cases/event-games-host-actions";
import { useEventGameSessionUpdates } from "./use-event-game-session-updates";

export type EventGamesHostOptions = {
  eventId: string | null;
  role: PrismUserRole;
  eventStatus: string;
  archived: boolean;
  actualEndedAt?: string | null;
};

function errorMessage(error: unknown): string {
  if (
    typeof error === "object"
    && error !== null
    && "status" in error
    && (error.status === 401 || error.status === 403)
  ) {
    return "You are not authorized to manage games for this event.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Unable to complete the event games request. Try again.";
}

function replaceGame(
  games: PrismEventGameDefinition[],
  updated: PrismEventGameDefinition,
): PrismEventGameDefinition[] {
  return games.map((game) => game.id === updated.id ? updated : game);
}

function isEventClosed(status: string, archived: boolean, actualEndedAt?: string | null): boolean {
  return archived || Boolean(actualEndedAt) || ["closed", "archived"].includes(status.trim().toLowerCase());
}

function isCurrentHostLoad(
  generation: number,
  currentGeneration: number,
  currentEventId: string | null,
  requestedEventId: string | null,
): boolean {
  return generation === currentGeneration && currentEventId === requestedEventId;
}

export function useEventGamesHostViewModel({
  eventId,
  role,
  eventStatus,
  archived,
  actualEndedAt,
}: EventGamesHostOptions) {
  const hostRole = role === "pmcm-admin" || role === "coordinator";
  const eventClosed = isEventClosed(eventStatus, archived, actualEndedAt);
  const canManage = hostRole && !eventClosed;
  const canReviewResponses = role === "pmcm-admin" && eventClosed;
  const canReadWorkspace = canManage || canReviewResponses;
  const activeEventId = useRef(eventId);
  const activeSelectedSessionId = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  activeEventId.current = eventId;

  const [games, setGames] = useState<PrismEventGameDefinition[]>([]);
  const [analytics, setAnalytics] = useState<PrismEventGameAnalytics | null>(null);
  const [hostState, setHostState] = useState<PrismGameHostState | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [responses, setResponses] = useState<PrismGameSessionResponse[]>([]);
  const [responseCursor, setResponseCursor] = useState<string | null>(null);
  const [responsesHaveMore, setResponsesHaveMore] = useState(false);
  const [lobbySlug, setLobbySlug] = useState<string | null>(null);
  const [lobbyBranding, setLobbyBranding] = useState<PrismEventGameHostLobbyBranding | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [pinDismissed, setPinDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId || !canReadWorkspace) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const workspace = await eventGamesHostActions.loadWorkspace(eventId);
      if (!isCurrentHostLoad(generation, loadGeneration.current, activeEventId.current, eventId)) return;
      setGames(canManage ? workspace.games : []);
      setAnalytics(workspace.analytics);
      setLobbyBranding(canManage ? workspace.branding : null);
      setError(null);
    } catch (cause) {
      if (isCurrentHostLoad(generation, loadGeneration.current, activeEventId.current, eventId)) {
        setError(errorMessage(cause));
      }
    } finally {
      if (isCurrentHostLoad(generation, loadGeneration.current, activeEventId.current, eventId)) {
        setLoading(false);
      }
    }
  }, [canManage, canReadWorkspace, eventId]);

  useEffect(() => {
    loadGeneration.current += 1;
    setGames([]);
    setAnalytics(null);
    setHostState(null);
    setSelectedSessionId(null);
    activeSelectedSessionId.current = null;
    setResponses([]);
    setResponseCursor(null);
    setResponsesHaveMore(false);
    setLobbySlug(null);
    setLobbyBranding(null);
    setRevealedPin(null);
    setPinDismissed(false);
    setLoading(false);
    setBusy(null);
    setError(null);
    void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [eventId, load]);

  const refreshSelectedSession = useCallback(async () => {
    if (!eventId || !selectedSessionId || !canManage) return false;
    const scopedEventId = eventId;
    const scopedSessionId = selectedSessionId;
    try {
      const [nextState, workspace] = await Promise.all([
        eventGamesHostActions.getHostState(scopedEventId, scopedSessionId),
        eventGamesHostActions.loadWorkspace(scopedEventId),
      ]);
      if (activeEventId.current !== scopedEventId || activeSelectedSessionId.current !== scopedSessionId) return false;
      setHostState(nextState);
      setGames(workspace.games);
      setAnalytics(workspace.analytics);
      setLobbyBranding(workspace.branding);
      setError(null);
      return true;
    } catch (cause) {
      if (activeEventId.current === scopedEventId && activeSelectedSessionId.current === scopedSessionId) {
        setError(errorMessage(cause));
      }
      return false;
    }
  }, [canManage, eventId, selectedSessionId]);
  const refreshSelectedSessionNow = useEventGameSessionUpdates({
    enabled: isRefreshableMultiplayerSession(hostState),
    refresh: refreshSelectedSession,
  });

  const perform = useCallback(async <T,>(
    label: string,
    operation: (scopedEventId: string) => Promise<T>,
    onSuccess: (value: T) => void,
  ): Promise<T | null> => {
    if (!eventId || !canManage) return null;
    const scopedEventId = eventId;
    setBusy(label);
    setError(null);
    try {
      const value = await operation(scopedEventId);
      if (activeEventId.current === scopedEventId) onSuccess(value);
      return value;
    } catch (cause) {
      if (activeEventId.current === scopedEventId) setError(errorMessage(cause));
      return null;
    } finally {
      if (activeEventId.current === scopedEventId) setBusy(null);
    }
  }, [canManage, eventId]);

  const createDraft = useCallback((input: PrismCreateEventGameInput) => perform(
    "create-game",
    (scopedEventId) => eventGamesHostActions.createDraft(scopedEventId, input),
    (game) => setGames((current) => [game, ...current.filter((item) => item.id !== game.id)]),
  ), [perform]);

  const updateDraft = useCallback((gameId: string, input: PrismUpdateEventGameInput) => perform(
    "update-game",
    (scopedEventId) => eventGamesHostActions.updateDraft(scopedEventId, gameId, input),
    (game) => setGames((current) => replaceGame(current, game)),
  ), [perform]);

  const archiveGame = useCallback((gameId: string) => perform(
    "archive-game",
    (scopedEventId) => eventGamesHostActions.archiveGame(scopedEventId, gameId),
    (game) => setGames((current) => replaceGame(current, game)),
  ), [perform]);

  const publishDraft = useCallback((gameId: string) => perform(
    "publish-game",
    (scopedEventId) => eventGamesHostActions.publishDraft(scopedEventId, gameId),
    (game) => setGames((current) => replaceGame(current, game)),
  ), [perform]);

  const selectSession = useCallback(async (sessionId: string) => {
    activeSelectedSessionId.current = sessionId;
    setSelectedSessionId(sessionId);
    setResponses([]);
    setResponseCursor(null);
    return perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, sessionId),
      setHostState,
    );
  }, [perform]);

  const scheduleSession = useCallback(async (gameId: string, scheduledStartAt?: string) => {
    const created = await perform(
      "schedule-session",
      (scopedEventId) => eventGamesHostActions.createHostSession(scopedEventId, gameId, scheduledStartAt),
      (session) => {
        activeSelectedSessionId.current = session.id;
        setSelectedSessionId(session.id);
        setHostState(null);
      },
    );
    if (!created || !eventId || activeEventId.current !== eventId) return created;
    const state = await perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, created.id),
      setHostState,
    );
    if (state) await load();
    return created;
  }, [eventId, load, perform]);

  const runHostCommand = useCallback(async (
    sessionId: string,
    command: PrismGameHostCommandInput["command"],
    roundKey?: string,
  ): Promise<PrismGameHostCommandResult | null> => {
    const result = await perform(
      "host-command",
      (scopedEventId) => eventGamesHostActions.executeHostCommand(scopedEventId, sessionId, command, roundKey),
      (value) => {
        if ("pin" in value) {
          setRevealedPin(value.pin);
          setPinDismissed(false);
        }
      },
    );
    if (!result || !eventId || activeEventId.current !== eventId) return result;
    const state = await perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, sessionId),
      setHostState,
    );
    if (state) await load();
    return result;
  }, [eventId, load, perform]);

  const dismissPin = useCallback(() => {
    setRevealedPin(null);
    setPinDismissed(true);
  }, []);

  const provisionLobby = useCallback(() => perform(
    "provision-lobby",
    (scopedEventId) => eventGamesHostActions.ensureLobby(scopedEventId),
    (lobby) => setLobbySlug(lobby.eventSlug),
  ), [perform]);

  const updateLobbyBranding = useCallback((settings: Omit<UpdateEventGameLobbyBrandingInput, "idempotencyKey">) => perform(
    "update-lobby-branding",
    (scopedEventId) => eventGamesHostActions.updateLobbyBranding(scopedEventId, settings),
    setLobbyBranding,
  ), [perform]);

  const uploadLobbyLogo = useCallback((file: File) => perform(
    "upload-lobby-logo",
    (scopedEventId) => eventGamesHostActions.uploadLobbyLogo(scopedEventId, file, lobbyBranding ?? {
      theme: "prism",
      primaryColor: PRISM_EVENT_GAME_BRAND_THEMES.prism.primaryColor,
      secondaryColor: PRISM_EVENT_GAME_BRAND_THEMES.prism.secondaryColor,
      logoUrl: null,
      logoObjectId: null,
    }),
    setLobbyBranding,
  ), [lobbyBranding, perform]);

  const uploadGameMedia = useCallback(async (gameId: string, file: File) => {
    const uploaded = await perform(
      "upload-game-media",
      (scopedEventId) => eventGamesHostActions.uploadGameMedia(scopedEventId, gameId, file),
      () => undefined,
    );
    if (!uploaded) throw new Error("The game image could not be uploaded. Try again.");
    return uploaded;
  }, [perform]);

  const loadResponses = useCallback(async (sessionId: string, cursor?: string) => {
    if (!canReviewResponses || !eventId) return null;
    const scopedEventId = eventId;
    setBusy("load-responses");
    setError(null);
    try {
      const page = await eventGamesHostActions.getResponseHistory(scopedEventId, sessionId, cursor);
      if (activeEventId.current !== scopedEventId) return null;
      setSelectedSessionId(sessionId);
      setResponses((current) => cursor ? [...current, ...page.items] : page.items);
      setResponseCursor(page.nextCursor);
      setResponsesHaveMore(page.hasMore);
      return page;
    } catch (cause) {
      if (activeEventId.current === scopedEventId) setError(errorMessage(cause));
      return null;
    } finally {
      if (activeEventId.current === scopedEventId) setBusy(null);
    }
  }, [canReviewResponses, eventId]);

  const loadMoreResponses = useCallback(() => {
    if (!selectedSessionId || !responseCursor) return Promise.resolve(null);
    return loadResponses(selectedSessionId, responseCursor);
  }, [loadResponses, responseCursor, selectedSessionId]);

  const moderateSubmission = useCallback(async (
    sessionId: string,
    submissionId: string,
    action: "approve_submission" | "hide_submission",
    reason?: string,
  ) => {
    if (!canManage) return null;
    const result = await perform(
      "moderate-response",
      (scopedEventId) => eventGamesHostActions.moderate(
        scopedEventId,
        sessionId,
        submissionId,
        action,
        reason,
      ),
      () => {},
    );
    if (result) {
      if (canReviewResponses) await loadResponses(sessionId);
      else if (selectedSessionId === sessionId) await selectSession(sessionId);
    }
    return result;
  }, [canManage, canReviewResponses, loadResponses, perform, selectSession, selectedSessionId]);

  const resolveFamilyFeudAnswer = useCallback(async (
    sessionId: string,
    submissionId: string,
    boardAnswer: string | null,
  ) => {
    if (!canManage) return null;
    const result = await perform(
      "resolve-family-feud-answer",
      (scopedEventId) => eventGamesHostActions.resolveFamilyFeudAnswer(
        scopedEventId, sessionId, submissionId, boardAnswer,
      ),
      () => {},
    );
    if (result && eventId && activeEventId.current === eventId) await selectSession(sessionId);
    return result;
  }, [canManage, eventId, perform, selectSession]);

  const assignAward = useCallback(async (
    sessionId: string,
    input: Omit<PrismAssignEventGameAwardInput, "idempotencyKey">,
  ) => {
    const result = await perform(
      "assign-award",
      (scopedEventId) => eventGamesHostActions.assignAward(scopedEventId, sessionId, input),
      () => {},
    );
    if (result && eventId && activeEventId.current === eventId) {
      await selectSession(sessionId);
    }
    return result;
  }, [eventId, perform, selectSession]);

  return {
    games,
    analytics,
    hostState,
    selectedSessionId,
    responses,
    responseCursor,
    responsesHaveMore,
    lobbySlug,
    lobbyBranding,
    revealedPin,
    pinDismissed,
    loading,
    busy,
    error,
    canManage,
    canReviewResponses,
    load,
    createDraft,
    updateDraft,
    archiveGame,
    publishDraft,
    scheduleSession,
    selectSession,
    runHostCommand,
    dismissPin,
    provisionLobby,
    updateLobbyBranding,
    uploadLobbyLogo,
    uploadGameMedia,
    loadResponses,
    loadMoreResponses,
    moderateSubmission,
    resolveFamilyFeudAnswer,
    assignAward,
    refreshSelectedSessionNow,
  };
}

function isRefreshableMultiplayerSession(state: PrismGameHostState | null): boolean {
  if (!state || !["scheduled", "lobby", "live", "paused"].includes(state.status)) return false;
  return [
    "live-trivia", "bingo", "guess-picture", "spin-wheel", "this-or-that", "family-feud", "split-the-room",
  ].includes(state.game.kind);
}
