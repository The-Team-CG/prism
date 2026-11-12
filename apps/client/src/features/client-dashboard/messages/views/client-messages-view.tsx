"use client";

import { ChatWorkspace, ViberMessagePrompt } from "@prism/ui/chat";
import { notificationPreferencesRepository } from "../../notifications/data/notification-preferences-repository";
import { useClientWorkspace } from "../../workspace/shared";
import { useClientMessagesViewModel } from "../view-models/use-client-messages-view-model";

export function ClientMessagesView() {
  const { isEventScopedView } = useClientWorkspace();
  const { selectedEvent, chat } = useClientMessagesViewModel(isEventScopedView);
  if (isEventScopedView && !selectedEvent) return null;
  return (
    <ChatWorkspace
      ariaLabel={selectedEvent && isEventScopedView ? `Messages for ${selectedEvent.eventName}` : "Messages across your events"}
      {...chat.workspace}
      notificationPrompt={<ViberMessagePrompt actions={notificationPreferencesRepository} href="/dashboard/notifications#viber-settings" />}
      composerPlaceholder={() => "Message the event team"}
      empty={{
        title: "No messages yet",
        body: selectedEvent && isEventScopedView ? `Messaging opens when PMCM starts a conversation for ${selectedEvent.eventName}.` : "Messaging opens when PMCM starts a conversation about one of your events.",
      }}
    />
  );
}
