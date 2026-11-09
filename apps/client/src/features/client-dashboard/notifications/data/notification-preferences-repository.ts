import { clientApi } from "@/lib/prism-api";

/** FR-25: the signed-in client's own notification channels. */
export const notificationPreferencesRepository = clientApi.notificationPreferences;
