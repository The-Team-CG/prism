/**
 * Event-portal I/O boundary.
 *
 * KISS: re-export the portal HTTP adapter instead of hand-wrapping every method.
 * Views still must not import `@/lib/prism-api` — import this (or use-cases) instead.
 */
import { prismApi } from "@/lib/prism-api";

export const eventOpsRepository = prismApi;

export type EventOpsRepository = typeof eventOpsRepository;
