import { createEventOpsClient } from "@prism/api-client";

/** Guests hold no session: every request names the event by its access code, so this client sends no token. */
export const guestApi = createEventOpsClient();
