"use client";

import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  isPrismAuthenticatedSession,
  readPrismSession,
  savePrismSession,
  type PrismAuthenticatedSession,
} from "@prism/types";

export type EventSession = PrismAuthenticatedSession;

export const EVENT_SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.event;

export function readStoredEventSession(): EventSession | null {
  const session = readPrismSession<unknown>(EVENT_SESSION_KEY);
  if (isPrismAuthenticatedSession(session)) return session;
  if (session) clearEventSession();
  return null;
}

export function saveEventSession(session: EventSession) {
  savePrismSession(EVENT_SESSION_KEY, session);
}

export function clearEventSession() {
  clearPrismSession(EVENT_SESSION_KEY);
}