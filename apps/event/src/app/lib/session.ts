"use client";

import type { PrismUser } from "@/lib/prism-api";
import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
} from "@prism/types";

export type EventSession = PrismUser & { signedInAt: string };

export const EVENT_SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.event;

export function readStoredEventSession(): EventSession | null {
  return readPrismSession<EventSession>(EVENT_SESSION_KEY);
}

export function saveEventSession(session: EventSession) {
  savePrismSession(EVENT_SESSION_KEY, session);
}

export function clearEventSession() {
  clearPrismSession(EVENT_SESSION_KEY);
}
