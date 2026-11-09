"use client";

import { MessageSquareText } from "lucide-react";
import { ChatWorkspace } from "@prism/ui/chat";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { useClientMessagesViewModel } from "../view-models/use-client-messages-view-model";

type MessagesVm = ReturnType<typeof useClientMessagesViewModel>;

const MESSAGE_TABS: Array<{ id: string; label: string; href: string }> = [
  { id: "messages-all", label: "All", href: "/dashboard/messages" },
  { id: "messages-inbox", label: "Inbox", href: CLIENT_PORTAL_VIEW_HREFS["messages-inbox"] },
  { id: "messages-event-conversations", label: "Event conversations", href: CLIENT_PORTAL_VIEW_HREFS["messages-event-conversations"] },
  { id: "messages-organizer-updates", label: "Organizer updates", href: CLIENT_PORTAL_VIEW_HREFS["messages-organizer-updates"] },
  { id: "messages-announcements", label: "Announcements", href: CLIENT_PORTAL_VIEW_HREFS["messages-announcements"] },
  { id: "messages-archived", label: "Archived", href: CLIENT_PORTAL_VIEW_HREFS["messages-archived"] },
];

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
  const { events, isEventScopedView, portalView } = useClientWorkspace();
  const vm = useClientMessagesViewModel(isEventScopedView);
  if (isEventScopedView) {
    return <MessagesBody vm={vm} hasEvents={events.length > 0} />;
  }
  const activeId = MESSAGE_TABS.find((tab) => tab.id === portalView)?.id ?? "messages-all";
  return (
    <div className="space-y-4">
      <ClientRouteTabs label="Message views" activeId={activeId} tabs={MESSAGE_TABS.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }))} />
      <ClientAccountEventPicker purpose="messages" destination="messages" />
      {events.length === 0 ? <MessagesBody vm={vm} hasEvents={false} /> : null}
    </div>
  );
}
