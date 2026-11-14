"use client";

import { ChatWorkspace } from "@prism/ui/chat";
import type { PrismEvent } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { useEventMessagesViewModel } from "../view-models/use-event-messages-view-model";

/** One event's conversations, or, without an event, every conversation PMCM is in. */
export function EventMessagesWorkspace({ event, events, session }: { event?: PrismEvent; events?: PrismEvent[]; session: EventSession }) {
  const vm = useEventMessagesViewModel({ event, events, session });
  return <ChatWorkspace ariaLabel={event ? `Messages for ${event.eventName}` : "Messages across all events"} {...vm.workspace} compose={vm.compose} />;
}
