"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";

import type { PrismAuditLog, PrismCommunicationThread, PrismEvent, PrismNotificationLog } from "@prism/types";
import { prismApi } from "@/lib/prism-api";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { EventSession } from "@/app/lib/session";
import {
  buildEventMessageThreads,
  initialsFrom,
  type EventMessage,
} from "./event-message-threads";

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
  useMemo(() => buildEventMessageThreads({ event, audit, notificationLogs }), [audit, event, notificationLogs]);
  const [persistedThreads, setPersistedThreads] = useState<PrismCommunicationThread[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const threads = persistedThreads.map((thread) => ({ id: thread.id, title: thread.subject, detail: `${thread.messages.length} messages`, tag: thread.status, status: thread.status, messages: thread.messages.map((message) => ({ id: message.id, author: message.senderRole, initials: initialsFrom(message.senderRole), body: message.body, time: message.createdAt, mine: message.senderId === session.id })) }));
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const [draft, setDraft] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(null);
    void prismApi.communicationThreads(event.id).then((next) => { if (!cancelled) { setPersistedThreads(next); setActiveThreadId(next[0]?.id); } }).catch((reason: unknown) => { if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Unable to load communication threads"); }).finally(() => { if (!cancelled) setLoading(false); });
    void prismApi.communicationParticipants(event.id).then(setParticipants).catch(() => setParticipants([]));
    return () => { cancelled = true; };
  }, [event.id, reload]);

  useEffect(() => {
    if (threads.some((thread) => thread.id === activeThreadId)) return;
    setActiveThreadId(threads[0]?.id);
  }, [activeThreadId, threads]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
  const messages = activeThread?.messages ?? [];

  function sendMessage() {
    if (!activeThread || !draft.trim()) return;
    const body = draft.trim();
    void prismApi.sendCommunicationMessage(activeThread.id, body, `pmcm-${activeThread.id}-${Date.now()}`).then((message) => { setPersistedThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, messages: [...thread.messages, message], updatedAt: message.createdAt } : thread)); setDraft(""); }).catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : "Unable to send message"));
  }

  if (loading) {
    return <EmptyState icon={MessageSquareText} title="Loading message threads" description="Checking persisted event communication…" />;
  }

  function createThread() {
    if (!subject.trim() || selectedParticipants.length === 0) return;
    void prismApi.createCommunicationThread(event.id, subject.trim(), selectedParticipants).then((thread) => { setPersistedThreads((current) => [thread, ...current]); setActiveThreadId(thread.id); setSubject(""); setSelectedParticipants([]); }).catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : "Unable to create thread"));
  }
  if (loadError && !activeThread) {
    return <EmptyState icon={MessageSquareText} title="Unable to load message threads" description={loadError} action={<Button type="button" onClick={() => setReload((value) => value + 1)}>Retry</Button>} />;
  }
  if (!activeThread) {
    return <EmptyState icon={MessageSquareText} title="No message threads" description="Create a thread with verified event participants." action={<div className="w-full max-w-md space-y-2 text-left"><input className="h-10 w-full rounded-md border border-border px-3 text-sm" value={subject} onChange={(input) => setSubject(input.target.value)} placeholder="Thread subject" /><div className="max-h-32 space-y-1 overflow-auto rounded-md border border-border p-2">{participants.map((participant) => <label key={participant.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedParticipants.includes(participant.id)} onChange={() => setSelectedParticipants((current) => current.includes(participant.id) ? current.filter((id) => id !== participant.id) : [...current, participant.id])} /><span>{participant.name} · {participant.role}</span></label>)}</div><Button type="button" disabled={!subject.trim() || selectedParticipants.length === 0} onClick={createThread}>Create thread</Button></div>} />;
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

        <EventMessageThreadPane
          event={event}
          thread={activeThread}
          messages={messages}
          draft={draft}
          onDraft={setDraft}
          onSend={sendMessage}
        />
      </div>
    </section>
  );
}

function EventMessageThreadPane({
  event,
  thread,
  messages,
  draft,
  onDraft,
  onSend,
}: {
  event: PrismEvent;
  thread: { title: string; detail: string; tag: string };
  messages: EventMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-foreground">{thread.title}</p>
            <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{thread.detail}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-black text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-1">{thread.tag}</span>
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
          <EventMessageBubble key={message.id} message={message} />
        ))}
      </div>

      <div className="border-t border-border bg-card p-4">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            placeholder={`Reply to ${thread.title}...`}
          />
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={onSend}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventMessageBubble({ message }: { message: EventMessage }) {
  return (
    <div className={`flex items-end gap-2 ${message.mine ? "justify-end" : "justify-start"}`}>
      {message.mine ? null : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-black text-foreground">
          {message.initials}
        </span>
      )}
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
  );
}
