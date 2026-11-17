import type { PrismCurrentUser } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { supplierApi } from "@/lib/prism-api";

/** The signed-in supplier's own account as the API knows it. */
export const supplierCurrentUserResource = defineResource<void, PrismCurrentUser>({
  name: "supplier.current-user",
  fetch: () => supplierApi.auth.me(),
});
