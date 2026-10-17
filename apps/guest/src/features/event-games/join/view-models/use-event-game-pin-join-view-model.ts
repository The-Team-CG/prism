"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAnonymousParticipantAlias,
  isValidGamePin,
  normalizeGamePin,
} from "../../model/event-game-entry-rules";
import type { GuestGameParticipantSession } from "../../data/event-games-guest-repository";
import {
  joinActiveMultiplayerGame,
  leaveEventGamesOnThisDevice,
  readCurrentGameParticipantSession,
} from "../use-cases/join-active-multiplayer-game";

export function useEventGamePinJoinViewModel(expectedEventSlug?: string) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<GuestGameParticipantSession | null>(null);

  useEffect(() => {
    setCurrentSession(readCurrentGameParticipantSession());
  }, []);

  function updatePin(value: string) {
    setPin(value.slice(0, 12));
    if (error) setError(null);
  }

  async function submit() {
    const normalizedPin = normalizeGamePin(pin);
    if (status === "loading") return;
    if (!isValidGamePin(normalizedPin)) {
      setError("Enter the 6-digit game PIN.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const joined = await joinActiveMultiplayerGame(normalizedPin, expectedEventSlug);
      setCurrentSession(readCurrentGameParticipantSession());
      router.replace(`/games/session/${encodeURIComponent(joined.sessionId)}`);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "This game is unavailable. Check the PIN and try again.");
    }
  }

  function clearSavedSession() {
    leaveEventGamesOnThisDevice();
    setCurrentSession(null);
  }

  return {
    pin,
    status,
    error,
    currentSession,
    participantAlias: currentSession
      ? createAnonymousParticipantAlias(currentSession.participantCredential)
      : null,
    busy: status === "loading",
    canSubmit: isValidGamePin(normalizeGamePin(pin)) && status !== "loading",
    updatePin,
    submit,
    clearSavedSession,
  };
}
