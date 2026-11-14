"use client";

import { useInvalidate } from "@prism/portal-query";
import { inboxThreadPage, useChatThreads } from "@prism/ui/chat";
import { useClientWorkspace } from "../../workspace/shared";
import { clientMessagesRepository } from "../data/client-messages-repository";
import { clientUnreadMessages } from "../data/client-messages-unread-resource";

/** Inside an event: that event's conversations. On the account page: one inbox across the client's events. */
export function useClientMessagesViewModel(eventScoped: boolean) {
  const { selectedEvent, session } = useClientWorkspace();
  const eventId = eventScoped ? selectedEvent?.id : undefined;
  const invalidate = useInvalidate();
  const chat = useChatThreads({
    scope: eventScoped ? eventId : "inbox",
    viewerId: session?.id,
    source: {
      list: (request) => (eventId ? clientMessagesRepository.list(eventId, request) : clientMessagesRepository.inbox(request).then(inboxThreadPage)),
      thread: clientMessagesRepository.thread,
      history: eventScoped ? undefined : clientMessagesRepository.history,
      older: clientMessagesRepository.listOlder,
      send: clientMessagesRepository.send,
      markRead: (threadId) => clientMessagesRepository.markRead(threadId).then(() => invalidate(clientUnreadMessages)),
    },
  });
  return { selectedEvent, chat };
}
