"use client";

import { ChatWorkspace } from "@prism/ui/chat";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { useClientMessagesViewModel } from "../view-models/use-client-messages-view-model";

type MessagesVm = ReturnType<typeof useClientMessagesViewModel>;

function MessagesBody({ vm, hasEvents }: { vm: MessagesVm; hasEvents: boolean }) {
  if (!vm.selectedEvent) {
    return hasEvents ? null : <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Messages will appear when your event workspace is available.</p>;
  }
  return (
    <ChatWorkspace
      ariaLabel={`Messages for ${vm.selectedEvent.eventName}`}
      threads={vm.chatThreads}
      visibleThreads={vm.visibleThreads}
      viewerId={vm.session?.id}
      activeThreadId={vm.activeThread?.id}
      onOpenThread={vm.selectThread}
      query={vm.query}
      onQueryChange={vm.setQuery}
      loading={vm.status === "loading"}
      error={vm.error}
      onRetry={vm.retry}
      busy={vm.busy}
      draft={vm.draft}
      onDraftChange={vm.updateDraft}
      onSend={() => void vm.sendMessage()}
      onLoadOlder={() => void vm.loadOlder()}
      composerPlaceholder={() => "Message the event team"}
      empty={{ title: "No messages yet", body: `Messaging opens when PMCM starts a conversation for ${vm.selectedEvent.eventName}.` }}
    />
  );
}

export function ClientMessagesView() {
  const { events, isEventScopedView } = useClientWorkspace();
  const vm = useClientMessagesViewModel(isEventScopedView);
  return (
    <div className="space-y-4">
      {!isEventScopedView ? <ClientAccountEventPicker purpose="messages" destination="messages" /> : null}
      {isEventScopedView || events.length === 0 ? <MessagesBody vm={vm} hasEvents={events.length > 0} /> : null}
    </div>
  );
}
