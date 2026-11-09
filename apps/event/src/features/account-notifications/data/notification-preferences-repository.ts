import { eventApi } from "@/lib/prism-api";

/** FR-25: the signed-in PMCM or coordinator account's own notification channels. */
export const notificationPreferencesRepository = eventApi.notificationPreferences;
