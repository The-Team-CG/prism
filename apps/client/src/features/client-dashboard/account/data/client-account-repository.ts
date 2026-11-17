import type { PrismCurrentUser } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

/** The signed-in client's own account as the API knows it. */
export const clientCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "client.current-user",
  fetch: () => clientApi.auth.me(),
});
