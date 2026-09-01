"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, Send } from "lucide-react";

import type { PrismAuditLog, PrismEvent, PrismNotificationLog } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { EventSession } from "@/app/lib/session";

type EventMessage = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
  mine: boolean;
  status?: string;
};

type EventMessageThread = {
  id: string;
  title: string;
  detail: string;
  tag: string;
  status: string;
  messages: EventMessage[];
};

function lbl(value: string) {
  return value.replaceAll("_", " ");
}

function initialsFrom(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PM";
}

function messageTime(value?: string) {
  if (!value) return "Now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function auditMessage(item: PrismAuditLog): EventMessage {
  const author = item.actor || "PMCM Team";
  return {
    id: `audit-${item.id}`,
    author,
    initials: initialsFrom(author),
    body: item.action,
    time: messageTime(item.createdAt),
    mine: item.actorRole === "pmcm-admin",
    status: lbl(item.category || item.actionType || "update"),
  };
}

function outboundMessage(item: PrismNotificationLog): EventMessage {
  const channel = lbl(item.channel);
  return {
    id: `outbound-${item.id}`,
    author: "PMCM Team",
    initials: "PM",
    body: item.message,
    time: messageTime(item.createdAt),
    mine: true,
    status: `${channel} to ${item.recipient}`,
  };
}

function buildEventMessageThreads({
  audit,
  event,
  notificationLogs,
}: {
  audit: PrismAuditLog[];
  event: PrismEvent;
  notificationLogs: PrismNotificationLog[];
}): EventMessageThread[] {
  const clientAudit = audit.filter((item) =>
    /client|briefing|conforme|proposal|billing|floor/i.test(`${item.actorRole} ${item.action} ${item.category}`),
  );
  const coordinatorAudit = audit.filter((item) => /coordinator|assignment|event day/i.test(`${item.action} ${item.category}`));
  const supplierAudit = audit.filter((item) => /supplier|quote|Supplier/i.test(`${item.action} ${item.category}`));

  const clientOutbound = notificationLogs.filter((item) => /client|briefing|billing|proposal|floor/i.test(item.message));
  const coordinatorOutbound = notificationLogs.filter((item) => /coordinator|assignment/i.test(item.message));
  const supplierOutbound = notificationLogs.filter((item) => /supplier|quote|menu|setup|contract/i.test(item.message));

  const clientMessages = [
    ...clientAudit.slice(0, 4).map(auditMessage),
    ...clientOutbound.slice(0, 4).map(outboundMessage),
  ];
  const coordinatorMessages = [
    ...coordinatorAudit.slice(0, 4).map(auditMessage),
    ...coordinatorOutbound.slice(0, 5).map(outboundMessage),
  ];
  const supplierMessages = [
    ...supplierAudit.slice(0, 4).map(auditMessage),
    ...supplierOutbound.slice(0, 4).map(outboundMessage),
  ];
  const internalMessages = audit.slice(0, 6).map(auditMessage);

  return [
    {
      id: "client",
      title: event.clientName,
      detail: `${event.eventName} client thread`,
      tag: "Client",
      status: `${clientMessages.length || 1} item${clientMessages.length === 1 ? "" : "s"}`,
      messages: clientMessages.length
        ? clientMessages
        : [{
            id: "client-empty",
            author: "PMCM Team",
            initials: "PM",
            body: `Client coordination thread for ${event.eventName}.`,
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "coordinators",
      title: "Coordinator Team",
      detail: "Assignments, call times, and day-of updates",
      tag: "Team",
      status: `${coordinatorMessages.length || 1} item${coordinatorMessages.length === 1 ? "" : "s"}`,
      messages: coordinatorMessages.length
        ? coordinatorMessages
        : [{
            id: "coordinators-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Coordinator thread is ready for assignment confirmations and day-of status replies.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "suppliers",
      title: "Supplier Desk",
      detail: "Quotes, setup notes, attachments, and confirmations",
      tag: "Supplier",
      status: `${supplierMessages.length || 1} item${supplierMessages.length === 1 ? "" : "s"}`,
      messages: supplierMessages.length
        ? supplierMessages
        : [{
            id: "suppliers-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Supplier thread is ready for quote follow-ups, call times, contracts, and setup confirmations.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "internal",
      title: "PMCM Internal",
      detail: "Team-only operational updates",
      tag: "Internal",
      status: `${internalMessages.length || 1} item${internalMessages.length === 1 ? "" : "s"}`,
      messages: internalMessages.length
        ? internalMessages
        : [{
            id: "internal-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Internal thread is ready for PMCM coordination notes.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
  ];
}

export function EventMessagesWorkspace({
  event,
  session,
  audit,
  notificationLogs,
}: {
  event: PrismEvent;
  session: EventSession;
  audit: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
}) {
  const threads = useMemo(
    () => buildEventMessageThreads({ event, audit, notificationLogs }),
    [audit, event, notificationLogs],
  );
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id ?? "client");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Record<string, EventMessage[]>>({});

  useEffect(() => {
    if (threads.some((thread) => thread.id === activeThreadId)) return;
    setActiveThreadId(threads[0]?.id ?? "client");
  }, [activeThreadId, threads]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
  const messages = activeThread ? [...activeThread.messages, ...(localMessages[activeThread.id] ?? [])] : [];

  function sendMessage() {
    if (!activeThread || !draft.trim()) return;
    const body = draft.trim();
    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [
        ...(current[activeThread.id] ?? []),
        {
          id: `local-${activeThread.id}-${Date.now()}`,
          author: session.name,
          initials: initialsFrom(session.name),
          body,
          time: "Now",
          mine: true,
          status: "draft",
        },
      ],
    }));
    setDraft("");
  }

  if (!activeThread) {
    return <EmptyState icon={MessageSquareText} title="No message threads" description="Select an event workspace to view PMCM messages." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-primary/12 bg-card shadow-none">
      <div className="grid min-h-[680px] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-secondary/45 lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-4">
            <p className="text-sm font-black text-foreground">Event Threads</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{event.eventName}</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
                placeholder="Search threads..."
              />
            </div>
          </div>
          <div className="p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                data-active={thread.id === activeThread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition hover:bg-card data-[active=true]:bg-card data-[active=true]:shadow-sm"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {initialsFrom(thread.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black text-foreground">{thread.title}</span>
                    <span className="text-[11px] font-bold text-muted-foreground">{thread.status}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{thread.detail}</span>
                  <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                    {thread.tag}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-background">
          <div className="border-b border-border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-foreground">{activeThread.title}</p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{activeThread.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black text-muted-foreground">
                <span className="rounded-full bg-secondary px-2.5 py-1">{activeThread.tag}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">{event.status}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">{event.floorPlanStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            <div className="mx-auto w-fit rounded-md bg-secondary px-3 py-1 text-[11px] font-black text-muted-foreground">
              {event.eventDate}
            </div>
            {messages.map((message) => (
              <div key={message.id} className={`flex items-end gap-2 ${message.mine ? "justify-end" : "justify-start"}`}>
                {!message.mine ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-black text-foreground">
                    {message.initials}
                  </span>
                ) : null}
                <div className={`max-w-[min(48rem,82%)] ${message.mine ? "text-right" : "text-left"}`}>
                  <div
                    className={
                      message.mine
                        ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm font-medium leading-6 text-primary-foreground"
                        : "rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground shadow-sm ring-1 ring-border"
                    }
                  >
                    {message.body}
                  </div>
                  <div className={`mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground ${message.mine ? "justify-end" : "justify-start"}`}>
                    <span>{message.author}</span>
                    <span>{message.time}</span>
                    {message.status ? <span>{message.status}</span> : null}
                  </div>
                </div>
                {message.mine ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                    {message.initials}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-card p-4">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder={`Reply to ${activeThread.title}...`}
              />
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={sendMessage}
                className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
