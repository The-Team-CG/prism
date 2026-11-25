"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { portalUrlFor, type PrismGameHostState } from "@prism/types";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import { eventGamesHostRepository } from "../host/data/event-games-host-repository";
import { eventGamesHostActions } from "../host/use-cases/event-games-host-actions";
import { resolveGuestGameJoinUrl } from "./presenter-join-url";

export const PRESENTER_POLL_INTERVAL_MS = 2_000;

const TERMINAL_STATUSES = new Set<PrismGameHostState["status"]>(["completed", "cancelled"]);

function errorStatus(error: unknown): number | null {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
}

function presenterErrorMessage(error: unknown): string {
  const status = errorStatus(error);
  if (status === 401) return "Your session has ended. Sign in to the event portal again, then reopen this screen.";
  if (status === 403) return "You are not authorized to present games for this event.";
  if (status === 404) return "This game session could not be found for this event.";
  return error instanceof Error && error.message
    ? `Could not load the game: ${error.message}`
    : "Could not load the game. Retrying.";
}

/** Errors that will not fix themselves on the next poll. */
function isPermanentError(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 401 || status === 403 || status === 404;
}

export interface PresenterViewModel {
  state: PrismGameHostState | null;
  /** Local clock (ms) when `state` arrived; anchors the countdown to `state.serverTime`. */
  receivedAt: number | null;
  error: string | null;
  joinUrl: string | null;
  joinError: string | null;
  pin: string | null;
  issuingPin: boolean;
  pinError: string | null;
  issuePin: () => Promise<void>;
  /** Signed address of the current round's picture (Guess the Picture). */
  pictureUrl: string | null;
}

/** Signed picture reads expire, so a long round re-signs before the link runs out. */
const PICTURE_RESIGN_MS = 4 * 60_000;

function usePresenterPicture(eventId: string, sessionId: string, mediaObjectId: string | undefined): string | null {
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    setPictureUrl(null);
    if (!mediaObjectId) return () => { disposed = true; };
    const load = () => {
      eventGamesHostRepository.getHostMediaUrl(eventId, sessionId, mediaObjectId).then(
        (url) => { if (!disposed) setPictureUrl(url); },
        () => { /* The picture is decoration on the room screen; the game carries on without it. */ },
      );
    };
    load();
    const timer = window.setInterval(load, PICTURE_RESIGN_MS);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [eventId, sessionId, mediaObjectId]);
  return pictureUrl;
}

export function usePresenterViewModel(eventId: string, sessionId: string): PresenterViewModel {
  const [state, setState] = useState<PrismGameHostState | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [issuingPin, setIssuingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const scope = useRef({ eventId, sessionId });
  scope.current = { eventId, sessionId };

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    const poll = async () => {
      let stop = false;
      try {
        const next = await eventGamesHostRepository.getHostState(eventId, sessionId);
        if (disposed) return;
        setState(next);
        setReceivedAt(Date.now());
        setError(null);
        stop = TERMINAL_STATUSES.has(next.status);
      } catch (cause) {
        if (disposed) return;
        setError(presenterErrorMessage(cause));
        stop = isPermanentError(cause);
      }
      if (!disposed && !stop) timer = window.setTimeout(() => { void poll(); }, PRESENTER_POLL_INTERVAL_MS);
    };
    void poll();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [eventId, sessionId]);

  useEffect(() => {
    let disposed = false;
    setJoinUrl(null);
    setJoinError(null);
    let guestPortalUrl: string;
    try {
      guestPortalUrl = portalUrlFor("guest", portalUrlsFromEnvironment());
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "The guest portal address is not configured.");
      return;
    }
    eventGamesHostRepository.ensureLobby(eventId).then(
      ({ eventSlug }) => {
        if (!disposed) setJoinUrl(resolveGuestGameJoinUrl(eventSlug, guestPortalUrl, window.location.origin));
      },
      () => {
        if (!disposed) setJoinError("The join link is not available right now.");
      },
    );
    return () => { disposed = true; };
  }, [eventId]);

  const issuePin = useCallback(async () => {
    const requested = { eventId, sessionId };
    setIssuingPin(true);
    setPinError(null);
    try {
      const result = await eventGamesHostActions.executeHostCommand(eventId, sessionId, "enable-joins");
      if (scope.current.eventId !== requested.eventId || scope.current.sessionId !== requested.sessionId) return;
      if ("pin" in result) setPin(result.pin);
    } catch (cause) {
      setPinError(errorStatus(cause) === 403
        ? "You are not authorized to issue a PIN for this game."
        : "Could not issue a PIN. Try again.");
    } finally {
      setIssuingPin(false);
    }
  }, [eventId, sessionId]);

  const pictureUrl = usePresenterPicture(eventId, sessionId, state?.currentRound?.picture?.mediaObjectId);

  return { state, receivedAt, error, joinUrl, joinError, pin, issuingPin, pinError, issuePin, pictureUrl };
}
