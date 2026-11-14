"use client";
import { useEffect, useState } from "react";
import type { PrismCommunicationParticipantChoice, PrismEvent } from "@prism/types";
import { useInvalidate } from "@prism/portal-query";
import { inboxThreadRecords, useChatThreads, type ChatCompose } from "@prism/ui/chat";
import type { EventSession } from "@/app/lib/session";
import { eventMessagesRepository } from "../data/event-messages-repository";
import { eventUnreadMessages } from "../data/event-messages-unread-resource";

/**
 * PMCM conversations. With an event it is that event's threads; without one it is the inbox across every
 * event, where a new conversation first names its event.
 */
export function useEventMessagesViewModel({ event, events = [], session }: { event?: PrismEvent; events?: PrismEvent[]; session: EventSession }) {
  const canCompose = session.role === 'pmcm-admin';
  const [participants, setParticipants] = useState<PrismCommunicationParticipantChoice[]>([]);
  const [composing, setComposing] = useState(false);
  const [chosenEventId, setChosenEventId] = useState<string>();
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const eventId = event?.id;
  const composeEventId = eventId ?? chosenEventId;
  const invalidate = useInvalidate();

  const chat = useChatThreads({
    scope: eventId ?? "inbox",
    viewerId: session.id,
    source: {
      list: () => (eventId ? eventMessagesRepository.list(eventId) : eventMessagesRepository.inbox().then(inboxThreadRecords)),
      history: eventId ? undefined : eventMessagesRepository.history,
      older: eventMessagesRepository.listOlder,
      send: eventMessagesRepository.send,
      markRead: (threadId) => eventMessagesRepository.markRead(threadId).then(() => invalidate(eventUnreadMessages)),
      readReceipts: canCompose ? eventMessagesRepository.readReceipts : undefined,
    },
  });

  // Who may join depends on the event, so the choices follow whichever event the new conversation is for.
  useEffect(() => {
    setParticipants([]);
    setSelected([]);
    if (!composeEventId || !canCompose) return;
    let cancelled = false;
    void eventMessagesRepository
      .participants(composeEventId)
      .then((next) => {
        if (!cancelled) setParticipants(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [composeEventId, canCompose]);

  async function createThread() {
    if (!canCompose || !composeEventId || !subject.trim() || selected.length === 0 || creating) return;
    setCreating(true);
    setComposeError(null);
    try {
      const thread = await eventMessagesRepository.create(composeEventId, subject.trim(), selected);
      chat.addThread(eventId ? thread : { ...thread, context: events.find((item) => item.id === composeEventId)?.eventName });
      setComposing(false);
      setSubject("");
      setSelected([]);
    } catch (reason) {
      setComposeError(reason instanceof Error ? reason.message : "Unable to start conversation");
    } finally {
      setCreating(false);
    }
  }

  const compose: ChatCompose = {
    open: composing,
    onStart: () => {
      setComposing(true);
      setComposeError(null);
    },
    onCancel: () => {
      setComposing(false);
      setComposeError(null);
    },
    contextLabel: event ? `People working on ${event.eventName}` : "Choose the event, then who should be in it",
    event: event ? undefined : { options: events.map((item) => ({ id: item.id, label: item.eventName })), value: chosenEventId, onChange: setChosenEventId },
    participants: participants.filter((participant) => participant.id !== session.id),
    selected,
    onToggle: (id) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])),
    subject,
    onSubjectChange: setSubject,
    onCreate: () => void createThread(),
  };

  return {
    workspace: { ...chat.workspace, busy: chat.workspace.busy || creating, error: composeError ?? chat.workspace.error },
    compose: canCompose ? compose : undefined,
    canInspectReadReceipts: canCompose,
  };
}
