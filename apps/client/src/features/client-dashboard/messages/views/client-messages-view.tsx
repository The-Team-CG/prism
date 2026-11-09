"use client";

import { MessageSquareText } from "lucide-react";
import { ChatWorkspace } from "@prism/ui/chat";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { useClientMessagesViewModel } from "../view-models/use-client-messages-view-model";

type MessagesVm = ReturnType<typeof useClientMessagesViewModel>;

function EmptyMessages({ title, body }: { title: string; body: string }) {
  return (
    <Empty className="gap-4 p-8 md:p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareText aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-semibold text-foreground">
          <h3>{title}</h3>
        </EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function MessagesBody({ vm, hasEvents }: { vm: MessagesVm; hasEvents: boolean }) {
  if (!vm.selectedEvent) {
    return hasEvents ? null : <EmptyMessages title="No event to message about" body="Messages will appear when your event workspace is available." />;
  }
  // With no conversations there is nothing for a chat list to hold, so the page shows one empty state.
  if (vm.status === "ready" && vm.chatThreads.length === 0) {
    return <EmptyMessages title="No messages yet" body={`Messaging opens when PMCM starts a conversation for ${vm.selectedEvent.eventName}.`} />;
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
  if (isEventScopedView) {
    return <MessagesBody vm={vm} hasEvents={events.length > 0} />;
  }
  return (
    <div className="space-y-4">
      <ClientAccountEventPicker purpose="messages" destination="messages" />
      {events.length === 0 ? <MessagesBody vm={vm} hasEvents={false} /> : null}
    </div>
  );
}
