import { isAccessRequestValid, normalizeAccessRequest } from "../model/sign-up-rules";
import type { AccessRequestDraft } from "../model/sign-up-types";

/**
 * Access requests are intake-only today (no remote endpoint yet).
 * Validate + normalize so the UI can show success consistently.
 */
export function submitAccessRequest(draft: AccessRequestDraft): { ok: true; request: AccessRequestDraft } | { ok: false } {
  if (!isAccessRequestValid(draft)) return { ok: false };
  return { ok: true, request: normalizeAccessRequest(draft) };
}
