"use client";

import { inboxThreadRecords, useChatThreads } from "@prism/ui/chat";
import { useClientWorkspace } from "../../workspace/shared";
import { clientMessagesRepository } from "../data/client-messages-repository";

/** Inside an event: that event's conversations. On the account page: one inbox across the client's events. */
export function useClientMessagesViewModel(eventScoped: boolean) {
  const { selectedEvent, session } = useClientWorkspace();
  const eventId = eventScoped ? selectedEvent?.id : undefined;
  const chat = useChatThreads({
    scope: eventScoped ? eventId : "inbox",
    viewerId: session?.id,
    source: {
      list: () => (eventId ? clientMessagesRepository.list(eventId) : clientMessagesRepository.inbox().then(inboxThreadRecords)),
      history: eventScoped ? undefined : clientMessagesRepository.history,
      older: clientMessagesRepository.listOlder,
      send: clientMessagesRepository.send,
      markRead: clientMessagesRepository.markRead,
    },
  });
  return { selectedEvent, chat };
}
