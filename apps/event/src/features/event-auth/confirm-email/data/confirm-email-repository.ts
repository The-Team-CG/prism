import { clearEventSession } from "@/app/lib/session";
import { eventApi } from "@/lib/prism-api";

/** Opens the change-of-email link; needs no session. */
export const confirmEventEmailChange = (token: string) => eventApi.auth.confirmEmailChange(token);

/** Every session ended with the change, so the one this browser kept goes too. */
export const forgetEventSession = () => clearEventSession();
