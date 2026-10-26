import { eventApiRequest } from "@/lib/prism-api";

/** Ends the server session. The caller clears the local session whatever the outcome. */
export function logoutEventSession() {
  return eventApiRequest<void>("/auth/logout", {
    method: "POST",
    // The request carries the stored token; an expired token must not redirect to sign-in with next=.
    onUnauthorized: () => undefined,
  });
}
