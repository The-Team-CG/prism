"use client";

import { ChatWorkspace } from "@prism/ui/chat";
import type { PrismEvent } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { useEventMessagesViewModel } from "../view-models/use-event-messages-view-model";

export function EventMessagesWorkspace({ event, session }: { event: PrismEvent; session: EventSession }) {
  const vm = useEventMessagesViewModel({ event, session });
  return (
    <ChatWorkspace
      ariaLabel={`Messages for ${event.eventName}`}
      threads={vm.threads}
      visibleThreads={vm.visibleThreads}
      people={vm.people}
      viewerId={vm.viewerId}
      activeThreadId={vm.activeThread?.id}
      onOpenThread={vm.openThread}
      query={vm.query}
      onQueryChange={vm.setQuery}
      loading={vm.loading}
      error={vm.loadError}
      busy={vm.busy}
      draft={vm.draft}
      onDraftChange={vm.updateDraft}
      onSend={() => void vm.sendMessage()}
      onLoadOlder={() => void vm.loadOlder()}
      compose={{
        open: vm.composing,
        onStart: vm.startNewConversation,
        onCancel: vm.cancelNewConversation,
        contextLabel: `People working on ${event.eventName}`,
        participants: vm.participants,
        subject: vm.subject,
        onSubjectChange: vm.setSubject,
        selected: vm.selectedParticipants,
        onToggle: vm.toggleParticipant,
        onCreate: () => void vm.createThread(),
      }}
    />
  );
}
