"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";
import { useEventGameSessionUpdates } from "./use-event-game-session-updates";
import {
  getEventGameParticipantState,
  getEventGameParticipantMediaAuthorization,
  leaveEventGamesFromSession,
  submitEventGameParticipantAction,
} from "../use-cases/event-game-participant";

export function useEventGamePlayViewModel(sessionId: string) {
  const router = useRouter();
  const [state, setState] = useState<PrismGamePublicState | null>(null);
  const stateRef = useRef<PrismGamePublicState | null>(null);
  const [participantAlias, setParticipantAlias] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [comparisonMediaUrl, setComparisonMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!stateRef.current) setStatus("loading");
    try {
      const nextState = await getEventGameParticipantState(sessionId);
      stateRef.current = nextState;
      setState(nextState);
      setParticipantAlias(nextState.participant.participantAlias);
      setStatus("ready");
      setError(null);
      return true;
    } catch (cause) {
      setParticipantAlias(stateRef.current?.participant.participantAlias ?? null);
      setStatus(stateRef.current ? "ready" : "error");
      setError(cause instanceof Error ? cause.message : "Game updates are unavailable. Try again in a moment.");
      return false;
    }
  }, [sessionId]);

  const shouldPoll = isActiveMultiplayerSession(state);
  const refreshNow = useEventGameSessionUpdates({ enabled: shouldPoll, refresh });

  useEffect(() => {
    void refreshNow();
  }, [refreshNow]);

  const mediaObjectIds = (() => {
    const data = state?.participant.gameData;
    if (data?.kind === "guess-picture" || data?.kind === "guess-picture-solo") return [data.mediaObjectId];
    if (data?.kind === "spot-the-difference") return [data.originalMediaObjectId, data.comparisonMediaObjectId];
    return [];
  })();
  const mediaObjectIdsKey = mediaObjectIds.join("|");
  useEffect(() => {
    let active = true;
    setMediaUrl(null);
    setComparisonMediaUrl(null);
    setMediaError(null);
    if (!mediaObjectIdsKey) return () => { active = false; };
    const requestedIds = mediaObjectIdsKey.split("|");
    void Promise.all(requestedIds.map((objectId) => getEventGameParticipantMediaAuthorization(sessionId, objectId)))
      .then((authorizations) => {
        if (!active) return;
        setMediaUrl(authorizations[0]?.downloadUrl ?? null);
        setComparisonMediaUrl(authorizations[1]?.downloadUrl ?? null);
      })
      .catch((cause) => {
        if (active) setMediaError(cause instanceof Error ? cause.message : "This game image is not available right now.");
      });
    return () => { active = false; };
  }, [mediaObjectIdsKey, sessionId]);

  const submitAction = useCallback(async (action: PrismSubmitEventGameActionInput) => {
    setActionBusy(true);
    setError(null);
    try {
      const nextState = await submitEventGameParticipantAction(sessionId, action);
      stateRef.current = nextState;
      setState(nextState);
      setParticipantAlias(nextState.participant.participantAlias);
      setStatus("ready");
      void refreshNow();
      return nextState;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your response could not be sent. Refresh the game and try again.");
      return null;
    } finally {
      setActionBusy(false);
    }
  }, [sessionId]);

  function exitGames() {
    leaveEventGamesFromSession();
    stateRef.current = null;
    setState(null);
    setParticipantAlias(null);
    router.replace("/games/join");
  }

  return { state, participantAlias, status, error, actionBusy, mediaUrl, comparisonMediaUrl, mediaError, refresh: refreshNow, exitGames, submitAction };
}

function isActiveMultiplayerSession(state: PrismGamePublicState | null): boolean {
  if (!state || !["lobby", "live", "paused"].includes(state.status)) return false;
  return [
    "live-trivia", "bingo", "guess-picture", "spin-wheel", "this-or-that", "family-feud", "split-the-room",
  ].includes(state.game.kind);
}
