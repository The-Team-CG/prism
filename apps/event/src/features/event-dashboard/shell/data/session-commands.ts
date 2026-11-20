import { createEventOpsClient } from "@prism/api-client";
import { storedEventAccessToken } from "@/lib/prism-api";

/**
 * Carries the stored token without the portal's session-expiry handler: signing out with an expired token must not
 * redirect to sign-in with next=.
 */
const logoutClient = createEventOpsClient({ getAuthToken: storedEventAccessToken });

/** Ends the server session. The caller clears the local session whatever the outcome. */
export function logoutEventSession() {
  return logoutClient.auth.logout();
}
