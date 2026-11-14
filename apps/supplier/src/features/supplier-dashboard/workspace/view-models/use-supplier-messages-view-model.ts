"use client";
import { useState } from "react";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useInvalidate } from "@prism/portal-query";
import { inboxThreadPage, useChatThreads, type ChatCompose } from "@prism/ui/chat";
import { supplierMessagesRepository } from "../data/supplier-messages-repository";
import { supplierUnreadMessages } from "../data/supplier-messages-unread-resource";

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
  const invalidate = useInvalidate();

  const chat = useChatThreads({
    scope: "inbox",
    viewerId: session.id,
    source: {
      list: (request) => supplierMessagesRepository.inbox(session, request).then(inboxThreadPage),
      thread: (threadId) => supplierMessagesRepository.thread(threadId, session),
      history: (threadId) => supplierMessagesRepository.history(threadId, session),
      older: (threadId, cursor) => supplierMessagesRepository.listOlder(threadId, cursor, session),
      send: (threadId, body, key, attachmentIds) => supplierMessagesRepository.send(threadId, body, key, attachmentIds, session),
      markRead: (threadId) => supplierMessagesRepository.markRead(threadId, session).then(() => invalidate(supplierUnreadMessages)),
      uploadAttachment: (thread, file) => supplierMessagesRepository.uploadAttachment(thread, file, session),
      copyAttachment: (thread, file) => supplierMessagesRepository.copyAttachment(thread, file, session),
      storedFiles: (thread) => supplierMessagesRepository.storedFiles(thread),
      downloadAttachment: (attachmentId) => supplierMessagesRepository.downloadAttachment(attachmentId, session),
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
