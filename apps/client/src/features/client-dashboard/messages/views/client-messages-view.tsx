"use client";

import { MessageSquareText, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { PrismCommunicationThread } from "@prism/types";
import { prismApi } from "@/lib/prism-api";
import { Input } from "@/app/components/ui/input";
import {
  clientActivityActor,
  clientActivityTitle,
} from "../../shared/tab-ui";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientMessagesView() {
  const {
    session,
    selectedEvent,
    audit,
    notifications,
  } = useClientWorkspace();

    const chatMessages = [
      ...notifications.map((item) => ({
        id: item.id,
        text: item.message,
        timestamp: item.createdAt,
        sender: "PMCM",
        initials: "PM",
        fromPmcm: true,
      })),
      ...audit.map((item) => ({
        id: item.id,
        text: clientActivityTitle(item.action),
        timestamp: item.createdAt,
        sender: clientActivityActor(item.actor),
        initials: item.actor.slice(0, 2).toUpperCase(),
        fromPmcm: item.actor.toLowerCase().includes("pmcm") || item.actor.toLowerCase().includes("coordinator"),
      })),
    ].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
  
  const clientInitials = session.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    const [threads, setThreads] = useState<PrismCommunicationThread[]>([]);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      if (!selectedEvent?.id) return;
      void prismApi.communicationThreads(selectedEvent.id).then(setThreads).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load messages"));
    }, [selectedEvent?.id]);
    const activeThread = threads[0];
    async function sendMessage() {
      if (!activeThread || !draft.trim()) return;
      const message = await prismApi.sendCommunicationMessage(activeThread.id, draft.trim(), `client-${activeThread.id}-${Date.now()}`);
      setThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, messages: [...thread.messages, message] } : thread));
      setDraft("");
    }
  
    return (
      <div className="space-y-4">
        {/* Chat header — only shown when not inside the event workspace (which already shows the event header) */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--prism-signal)] text-white font-black text-sm">
            PM
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-foreground">PMCM Events</p>
            <p className="text-xs text-muted-foreground">
              {selectedEvent ? `Chat for ${selectedEvent.eventName}` : "Your event coordination team"}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-(--prism-success)" />
            Active
          </span>
        </div>
  
        {/* Chat thread */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "420px" }}>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {error ? <p className="text-sm text-destructive">{error}</p> : activeThread ? activeThread.messages.map((msg) => ({ id: msg.id, text: msg.body, timestamp: msg.createdAt, sender: msg.senderRole, initials: msg.senderRole.slice(0, 2).toUpperCase(), fromPmcm: msg.senderRole !== "client" })).map((msg) => (
              <div key={msg.id} className={`flex items-end gap-3 ${msg.fromPmcm ? "" : "flex-row-reverse"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                  msg.fromPmcm
                    ? "bg-[var(--prism-signal)]/10 text-[var(--prism-signal)]"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {msg.fromPmcm ? "PM" : clientInitials}
                </span>
                <div className={`max-w-[72%] ${msg.fromPmcm ? "" : "items-end"} flex flex-col gap-1`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-5 ${
                    msg.fromPmcm
                      ? "rounded-bl-md bg-muted text-foreground"
                      : "rounded-br-md bg-[var(--prism-signal)] text-white"
                  }`}>
                    {msg.text}
                  </div>
                  <span className={`text-[10px] text-muted-foreground/60 ${msg.fromPmcm ? "pl-1" : "pr-1 text-right"}`}>
                    {msg.sender} · {msg.timestamp}
                  </span>
                </div>
              </div>
            )) : chatMessages.length ? chatMessages.map((msg) => (
              <div key={msg.id} className="text-sm text-muted-foreground">{msg.text}</div>
            )) : (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                  <MessageSquareText className="size-6 text-muted-foreground" />
                </span>
                <h3 className="mt-4 text-base font-black text-foreground">No messages yet</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  PMCM will send updates and coordination notes here once your event workspace is active.
                </p>
              </div>
            )}
          </div>
  
          {/* Message input */}
          <div className="border-t border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Input
                placeholder="Message PMCM…"
                className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
                disabled={!activeThread}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                disabled={!activeThread || !draft.trim()}
                onClick={() => void sendMessage()}
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--prism-signal)]/20 text-[var(--prism-signal)] opacity-50 cursor-not-allowed"
              >
                <Send className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {activeThread ? "Replies are event-scoped and visible to active participants." : "Messaging becomes available when PMCM opens an event thread."}
            </p>
          </div>
        </div>
      </div>
    );
}
