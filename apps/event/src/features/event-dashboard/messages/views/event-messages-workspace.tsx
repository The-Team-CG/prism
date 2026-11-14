"use client";

import { ChatWorkspace, ViberMessagePrompt } from "@prism/ui/chat";
import { notificationPreferencesRepository } from "@/features/account-notifications/data/notification-preferences-repository";
import type { PrismEvent } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { useEventMessagesViewModel } from "../view-models/use-event-messages-view-model";

/** One event's conversations, or, without an event, every conversation PMCM is in. */
export function EventMessagesWorkspace({ event, events, session }: { event?: PrismEvent; events?: PrismEvent[]; session: EventSession }) {
  const vm = useEventMessagesViewModel({ event, events, session });
  const settings = session.role === 'coordinator' ? '/dashboard?view=notifications' : '/dashboard/settings#notification-settings';
  return <ChatWorkspace ariaLabel={event ? `Messages for ${event.eventName}` : "Messages across all events"} {...vm.workspace} compose={vm.compose} showReadReceipts={vm.canInspectReadReceipts} notificationPrompt={<ViberMessagePrompt actions={notificationPreferencesRepository} href={settings} />} />;
}
