import { defineResource } from "@prism/portal-query";
import type { PmcmCalendarQuery } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

/** Money and unread messages per event, for the Finance, Files and Messages event lists. */
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
