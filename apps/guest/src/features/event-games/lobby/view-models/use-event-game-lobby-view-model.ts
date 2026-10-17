"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismEventGameLobby } from "@prism/types";
import { createAnonymousParticipantAlias } from "../../model/event-game-entry-rules";
import {
  getPublicEventGameLobby,
  leaveEventGamesFromLobby,
  readEventGameParticipantSession,
  startIndependentSingleplayerGame,
} from "../use-cases/event-game-lobby";

export function useEventGameLobbyViewModel(eventSlug: string) {
  const router = useRouter();
  const [lobby, setLobby] = useState<PrismEventGameLobby | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
  const [participantAlias, setParticipantAlias] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const nextLobby = await getPublicEventGameLobby(eventSlug);
      setLobby(nextLobby);
      const stored = readEventGameParticipantSession();
      setParticipantAlias(stored?.eventId === nextLobby.eventId
        ? createAnonymousParticipantAlias(stored.participantCredential)
        : null);
      setStatus("ready");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "This event games link is unavailable. Check the link and try again.");
    }
  }, [eventSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function startGame(gameId: string) {
    if (startingGameId) return;
    setStartingGameId(gameId);
    setError(null);
    try {
      const started = await startIndependentSingleplayerGame(eventSlug, gameId);
      const stored = readEventGameParticipantSession();
      setParticipantAlias(stored ? createAnonymousParticipantAlias(stored.participantCredential) : null);
      router.push(`/games/session/${encodeURIComponent(started.sessionId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This event game is not available right now. Return to the event lobby and try again.");
    } finally {
      setStartingGameId(null);
    }
  }

  function exitGames() {
    leaveEventGamesFromLobby();
    setParticipantAlias(null);
    router.replace("/games/join");
  }

  return { lobby, status, error, startingGameId, participantAlias, startGame, exitGames, reload };
}
