import { clearPrismSession, PRISM_SESSION_STORAGE_KEYS } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

/** Opens the change-of-email link; needs no session. */
export const confirmClientEmailChange = (token: string) => clientApi.auth.confirmEmailChange(token);

/** Every session ended with the change, so the one this browser kept goes too. */
export const forgetClientSession = () => clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client);
