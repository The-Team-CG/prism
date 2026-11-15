import { defineResource } from "@prism/portal-query";
import type { PmcmCalendarQuery } from "@prism/types";
import { getEventCoverImage } from "@prism/api-client";
import { eventApi, storedEventAccessToken } from "@/lib/prism-api";

/** Money and unread messages per event, for the Finance, Files and Messages event lists. */
/** A short-lived address for an event's cover image, keyed `eventId:coverObjectId` so a new cover reads afresh. */
export const pmcmEventCover = defineResource({
  name: "pmcm.event-cover",
  staleMs: 4 * 60_000,
  fetch: (key: string) => getEventCoverImage(key.slice(0, key.indexOf(":")), { authToken: storedEventAccessToken() }),
});

/** The Inbox's items grouped by event, for the Events cards. */
export const pmcmEventAttention = defineResource({
  name: "pmcm.event-attention",
  staleMs: 15_000,
  fetch: (_actor: "signed-in") => eventApi.pmcm.eventAttention(),
});

export const pmcmEventSummaries = defineResource({
  name: "pmcm.event-summaries",
  fetch: (_actor: "signed-in") => eventApi.pmcm.eventSummaries(),
});

/** Open and overdue file requirements per event, for the Files event list. Covers the events still in play. */
export const pmcmFileSummaries = defineResource({
  name: "pmcm.file-summaries",
  fetch: (_actor: "signed-in") => eventApi.pmcm.fileSummaries(),
});

/** Dated work across events inside a window of calendar dates. */
export const pmcmCalendar = defineResource({
  name: "pmcm.calendar",
  fetch: (window: PmcmCalendarQuery) => eventApi.pmcm.calendar(window),
});
