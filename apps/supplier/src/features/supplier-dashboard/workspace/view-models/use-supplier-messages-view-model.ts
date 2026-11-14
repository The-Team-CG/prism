"use client";
import { useState } from "react";
import type { PrismAuthenticatedSession } from "@prism/types";
import { inboxThreadRecords, useChatThreads, type ChatCompose } from "@prism/ui/chat";
import { supplierMessagesRepository } from "../data/supplier-messages-repository";

type BookedEvent = { eventId: string; eventName: string };

/**
 * A supplier's conversations with PMCM across every booked event. A new conversation always goes to the PMCM
 * team; with several bookings it first names the event it is about.
 */
export function useSupplierMessagesViewModel({ events, session }: { events: BookedEvent[]; session: PrismAuthenticatedSession }) {
  const [composing, setComposing] = useState(false);
  const [chosenEventId, setChosenEventId] = useState<string>();
  const [subject, setSubject] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const composeEvent = events.length === 1 ? events[0] : events.find((item) => item.eventId === chosenEventId);

  const chat = useChatThreads({
    scope: "inbox",
    viewerId: session.id,
    source: {
      list: () => supplierMessagesRepository.inbox(session).then(inboxThreadRecords),
      history: (threadId) => supplierMessagesRepository.history(threadId, session),
      older: (threadId, cursor) => supplierMessagesRepository.listOlder(threadId, cursor, session),
      send: (threadId, body, key) => supplierMessagesRepository.send(threadId, body, key, session),
      markRead: (threadId) => supplierMessagesRepository.markRead(threadId, session),
    },
  });

  async function createThread() {
    if (!composeEvent || !subject.trim() || creating) return;
    setCreating(true);
    setComposeError(null);
    try {
      const thread = await supplierMessagesRepository.create(composeEvent.eventId, subject.trim(), session);
      chat.addThread({ ...thread, context: composeEvent.eventName });
      setSubject("");
      setComposing(false);
    } catch (reason) {
      setComposeError(reason instanceof Error ? reason.message : "Unable to start this conversation");
    } finally {
      setCreating(false);
    }
  }

  // Without a booking there is no event to write about, so there is nothing to start.
  const compose: ChatCompose | undefined = events.length
    ? {
        open: composing,
        onStart: () => {
          setComposing(true);
          setComposeError(null);
        },
        onCancel: () => {
          setComposing(false);
          setComposeError(null);
        },
        contextLabel: events.length === 1 ? events[0].eventName : "Choose the event this is about",
        event: events.length > 1 ? { options: events.map((item) => ({ id: item.eventId, label: item.eventName })), value: chosenEventId, onChange: setChosenEventId } : undefined,
        recipient: "PMCM team",
        subject,
        onSubjectChange: setSubject,
        onCreate: () => void createThread(),
      }
    : undefined;

  return {
    workspace: { ...chat.workspace, busy: chat.workspace.busy || creating, error: composeError ?? chat.workspace.error },
    compose,
  };
}
