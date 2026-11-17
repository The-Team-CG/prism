import type { PrismCurrentUser } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** The signed-in PMCM staff member's or coordinator's own account as the API knows it. */
export const eventCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "event.current-user",
  fetch: () => eventApi.auth.me(),
});
