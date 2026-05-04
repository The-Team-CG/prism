"use client";

import type { MvpUser } from "@/lib/mvp-api";

export type EventSession = MvpUser & { signedInAt: string };

export const EVENT_SESSION_KEY = "prism:event-command-session";

export function readStoredEventSession(): EventSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(EVENT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EventSession;
  } catch {
    window.localStorage.removeItem(EVENT_SESSION_KEY);
    return null;
  }
}

export function saveEventSession(session: EventSession) {
  window.localStorage.setItem(EVENT_SESSION_KEY, JSON.stringify(session));
}

export function clearEventSession() {
  window.localStorage.removeItem(EVENT_SESSION_KEY);
}
