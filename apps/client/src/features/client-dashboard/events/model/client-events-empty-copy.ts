export type ClientEventsFilterId = "events-all" | "events-upcoming" | "events-in-planning" | "events-completed" | "events-cancelled";

export type ClientEventsEmptyCopy = {
  title: string;
  description: string;
  /** Only the filters that can still gain events offer a way to start one. */
  offersNewRequest: boolean;
};

const EMPTY_COPY: Record<ClientEventsFilterId, ClientEventsEmptyCopy> = {
  "events-all": {
    title: "No events here yet",
    description: "Events appear here once PMCM accepts your inquiry and the conforme is signed.",
    offersNewRequest: true,
  },
  "events-upcoming": {
    title: "No upcoming events",
    description: "Confirmed events with a date still ahead appear here.",
    offersNewRequest: true,
  },
  "events-in-planning": {
    title: "Nothing in planning",
    description: "Events move here while PMCM plans them with you, from the briefing to the event day.",
    offersNewRequest: true,
  },
  "events-completed": {
    title: "No completed events",
    description: "Events appear here after PMCM closes them out.",
    offersNewRequest: false,
  },
  "events-cancelled": {
    title: "No cancelled events",
    description: "Events PMCM has cancelled or stopped appear here with their history kept.",
    offersNewRequest: false,
  },
};

/** Copy for an empty event list. A search that finds nothing is a different question from an empty filter. */
export function clientEventsEmptyCopy(filterId: ClientEventsFilterId, searching: boolean): ClientEventsEmptyCopy {
  if (searching) {
    return { title: "No events match", description: "Try a different name, date or status.", offersNewRequest: false };
  }
  return EMPTY_COPY[filterId];
}
