import { defineResource } from "@prism/portal-query";
import { getEventCoverImage } from "@prism/api-client";
import { storedSupplierAccessToken } from "@/lib/prism-api";

/** A short-lived address for a booked event's cover image, keyed `eventId:coverObjectId` so a new cover reads afresh. */
export const supplierEventCover = defineResource({
  name: "supplier.event-cover",
  staleMs: 4 * 60_000,
  fetch: (key: string) => getEventCoverImage(key.slice(0, key.indexOf(":")), { authToken: storedSupplierAccessToken() }),
});
