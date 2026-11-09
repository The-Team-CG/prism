import { supplierApi } from "@/lib/prism-api";

/** FR-25: the signed-in supplier's own notification channels. */
export const notificationPreferencesRepository = supplierApi.notificationPreferences;
