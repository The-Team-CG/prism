"use client";

import { ClientEventFileLibrary } from "../../files";
import { useClientWorkspace } from "../../workspace/shared";

/** An event's Files tab: the same library as the portal's Files page, for this event. */
export function ClientDocumentsTab() {
  const { selectedEvent } = useClientWorkspace();
  return selectedEvent ? <ClientEventFileLibrary key={selectedEvent.id} eventId={selectedEvent.id} /> : null;
}
