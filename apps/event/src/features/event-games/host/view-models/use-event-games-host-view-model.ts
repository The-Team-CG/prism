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
import { useBackgroundRefresh } from "@prism/portal-query";

export type EventGamesHostOptions = {
  eventId: string | null;
  role: PrismUserRole;
  eventStatus: string;
  archived: boolean;
  actualEndedAt?: string | null;
};

type HostWorkspace = Awaited<ReturnType<typeof eventGamesHostActions.loadWorkspace>>;

/** A background refresh may clear only the live session's own error (or no error), never a game, create or lobby error. */
function canClearRefreshError(target: EventGamesErrorTarget | null): boolean {
  return target === null || target === "live";
}

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

type AnalyticsSession = PrismEventGameAnalytics["sessions"][number];

/** The session a host most likely wants to run: one already running, else the next one scheduled. */
export function pickRunnableSession(sessions: readonly AnalyticsSession[] | undefined): string | null {
  if (!sessions?.length) return null;
  const running = sessions.find((session) => ["live", "paused", "lobby"].includes(session.status));
  const scheduled = sessions.find((session) => session.status === "scheduled");
  return (running ?? scheduled)?.sessionId ?? null;
}

/** Where a failed action's error is shown: a game row, the create sheet, the lobby section, the live tab or response review. */
export type EventGamesErrorTarget = `game:${string}` | "create" | "lobby" | "live" | "responses";

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
  // Lobby branding and the lobby logo stay with PMCM Admins; coordinators still see the lobby link.
  const canBrandLobby = role === "pmcm-admin" && canManage;
  const canReadWorkspace = canManage || canReviewResponses;
  const activeEventId = useRef(eventId);
  const activeSelectedSessionId = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const lobbyEnsured = useRef(false);
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
  const [errorTarget, setErrorTarget] = useState<EventGamesErrorTarget | null>(null);
  // Mirrors the current error target so a background refresh can read it without re-subscribing.
  const errorTargetRef = useRef<EventGamesErrorTarget | null>(null);
  useEffect(() => { errorTargetRef.current = errorTarget; }, [errorTarget]);

  const perform = useCallback(async <T,>(
    label: string,
    operation: (scopedEventId: string) => Promise<T>,
    onSuccess: (value: T) => void,
    target: EventGamesErrorTarget | null = null,
  ): Promise<T | null> => {
    if (!eventId || !canManage) return null;
    const scopedEventId = eventId;
    setBusy(label);
    setError(null);
    setErrorTarget(null);
    try {
      const value = await operation(scopedEventId);
      if (activeEventId.current === scopedEventId) onSuccess(value);
      return value;
    } catch (cause) {
      if (activeEventId.current === scopedEventId) {
        setError(errorMessage(cause));
        setErrorTarget(target);
      }
      return null;
    } finally {
      if (activeEventId.current === scopedEventId) setBusy(null);
    }
  }, [canManage, eventId]);

  const selectSession = useCallback(async (sessionId: string) => {
    activeSelectedSessionId.current = sessionId;
    setSelectedSessionId(sessionId);
    // Drop the previous session's controls while this one loads, so Start or End can never act on the wrong session.
    setHostState(null);
    setResponses([]);
    setResponseCursor(null);
    return perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, sessionId),
      (state) => { if (activeSelectedSessionId.current === sessionId) setHostState(state); },
      "live",
    );
  }, [perform]);

  const applyLoadedWorkspace = useCallback((workspace: HostWorkspace) => {
    setGames(canManage ? workspace.games : []);
    setAnalytics(workspace.analytics);
    setLobbyBranding(canManage ? workspace.branding : null);
    setError(null);
    setErrorTarget(null);
    return canManage && !activeSelectedSessionId.current ? pickRunnableSession(workspace.analytics?.sessions) : null;
  }, [canManage]);

  // Ensure the lobby once per view, not on every reload after a command. If it cannot be fetched, the
  // lobby section keeps its "Create lobby link" button, which reports the error; a later load retries.
  const ensureLobbyLink = useCallback((scopedEventId: string, isCurrent: () => boolean) => {
    if (lobbyEnsured.current) return;
    lobbyEnsured.current = true;
    void eventGamesHostActions.ensureLobby(scopedEventId).then(
      (lobby) => { if (isCurrent()) setLobbySlug(lobby.eventSlug); },
      () => { lobbyEnsured.current = false; },
    );
  }, []);

  const load = useCallback(async () => {
    if (!eventId || !canReadWorkspace) return;
    const generation = ++loadGeneration.current;
    const isCurrent = () => isCurrentHostLoad(generation, loadGeneration.current, activeEventId.current, eventId);
    let autoSessionId: string | null = null;
    setLoading(true);
    try {
      const workspace = await eventGamesHostActions.loadWorkspace(eventId);
      if (!isCurrent()) return;
      autoSessionId = applyLoadedWorkspace(workspace);
    } catch (cause) {
      if (isCurrent()) {
        setError(errorMessage(cause));
        setErrorTarget(null);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
    if (!isCurrent()) return;
    if (canManage) ensureLobbyLink(eventId, isCurrent);
    if (autoSessionId) await selectSession(autoSessionId);
  }, [applyLoadedWorkspace, canManage, canReadWorkspace, ensureLobbyLink, eventId, selectSession]);

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
    lobbyEnsured.current = false;
    setRevealedPin(null);
    setPinDismissed(false);
    setLoading(false);
    setBusy(null);
    setError(null);
    setErrorTarget(null);
    void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [eventId, load]);

  const isSelectionCurrent = useCallback((scopedEventId: string, scopedSessionId: string) => (
    activeEventId.current === scopedEventId && activeSelectedSessionId.current === scopedSessionId
  ), []);

  const refreshSelectedSession = useCallback(async () => {
    if (!eventId || !selectedSessionId || !canManage) return false;
    const scopedEventId = eventId;
    const scopedSessionId = selectedSessionId;
    try {
      const [nextState, workspace] = await Promise.all([
        eventGamesHostActions.getHostState(scopedEventId, scopedSessionId),
        eventGamesHostActions.loadWorkspace(scopedEventId),
      ]);
      if (!isSelectionCurrent(scopedEventId, scopedSessionId)) return false;
      setHostState(nextState);
      setGames(workspace.games);
      setAnalytics(workspace.analytics);
      setLobbyBranding(workspace.branding);
      // A background refresh may clear only the live session's own error, never a game, create or lobby error.
      if (canClearRefreshError(errorTargetRef.current)) {
        setError(null);
        setErrorTarget(null);
      }
      return true;
    } catch (cause) {
      if (isSelectionCurrent(scopedEventId, scopedSessionId)) {
        setError(errorMessage(cause));
        setErrorTarget("live");
      }
      return false;
    }
  }, [canManage, eventId, isSelectionCurrent, selectedSessionId]);
  const refreshSelectedSessionNow = useBackgroundRefresh({
    enabled: isRefreshableMultiplayerSession(hostState),
    refresh: refreshSelectedSession,
  });

  const createDraft = useCallback((input: PrismCreateEventGameInput) => perform(
    "create-game",
    (scopedEventId) => eventGamesHostActions.createDraft(scopedEventId, input),
    (game) => setGames((current) => [game, ...current.filter((item) => item.id !== game.id)]),
    "create",
  ), [perform]);

  const updateDraft = useCallback((gameId: string, input: PrismUpdateEventGameInput) => perform(
    "update-game",
    (scopedEventId) => eventGamesHostActions.updateDraft(scopedEventId, gameId, input),
    (game) => setGames((current) => replaceGame(current, game)),
    `game:${gameId}`,
  ), [perform]);

  const archiveGame = useCallback((gameId: string) => perform(
    "archive-game",
    (scopedEventId) => eventGamesHostActions.archiveGame(scopedEventId, gameId),
    (game) => setGames((current) => replaceGame(current, game)),
    `game:${gameId}`,
  ), [perform]);

  const publishDraft = useCallback((gameId: string) => perform(
    "publish-game",
    (scopedEventId) => eventGamesHostActions.publishDraft(scopedEventId, gameId),
    (game) => setGames((current) => replaceGame(current, game)),
    `game:${gameId}`,
  ), [perform]);

  const scheduleSession = useCallback(async (gameId: string, scheduledStartAt?: string) => {
    const created = await perform(
      "schedule-session",
      (scopedEventId) => eventGamesHostActions.createHostSession(scopedEventId, gameId, scheduledStartAt),
      (session) => {
        activeSelectedSessionId.current = session.id;
        setSelectedSessionId(session.id);
        setHostState(null);
      },
      `game:${gameId}`,
    );
    if (!created || !eventId || activeEventId.current !== eventId) return created;
    const state = await perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, created.id),
      (state) => { if (activeSelectedSessionId.current === created.id) setHostState(state); },
      "live",
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
      "live",
    );
    if (!result || !eventId || activeEventId.current !== eventId) return result;
    const state = await perform(
      "load-session",
      (scopedEventId) => eventGamesHostActions.getHostState(scopedEventId, sessionId),
      (state) => { if (activeSelectedSessionId.current === sessionId) setHostState(state); },
      "live",
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
    "lobby",
  ), [perform]);

  const updateLobbyBranding = useCallback((settings: Omit<UpdateEventGameLobbyBrandingInput, "idempotencyKey">) => perform(
    "update-lobby-branding",
    (scopedEventId) => eventGamesHostActions.updateLobbyBranding(scopedEventId, settings),
    setLobbyBranding,
    "lobby",
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
    "lobby",
  ), [lobbyBranding, perform]);

  const uploadGameMedia = useCallback(async (gameId: string, file: File) => {
    const uploaded = await perform(
      "upload-game-media",
      (scopedEventId) => eventGamesHostActions.uploadGameMedia(scopedEventId, gameId, file),
      () => undefined,
      `game:${gameId}`,
    );
    if (!uploaded) throw new Error("The game image could not be uploaded. Try again.");
    return uploaded;
  }, [perform]);

  const loadResponses = useCallback(async (sessionId: string, cursor?: string) => {
    if (!canReviewResponses || !eventId) return null;
    const scopedEventId = eventId;
    setBusy("load-responses");
    setError(null);
    setErrorTarget(null);
    try {
      const page = await eventGamesHostActions.getResponseHistory(scopedEventId, sessionId, cursor);
      if (activeEventId.current !== scopedEventId) return null;
      setSelectedSessionId(sessionId);
      setResponses((current) => cursor ? [...current, ...page.items] : page.items);
      setResponseCursor(page.nextCursor);
      setResponsesHaveMore(page.hasMore);
      return page;
    } catch (cause) {
      if (activeEventId.current === scopedEventId) {
        setError(errorMessage(cause));
        setErrorTarget("responses");
      }
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
      "live",
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
      "live",
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
      "live",
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
    errorTarget,
    hostRole,
    eventClosed,
    canManage,
    canReviewResponses,
    canBrandLobby,
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
    "live-poll", "word-cloud", "open-qa", "presenter-deck",
  ].includes(state.game.kind);
}
