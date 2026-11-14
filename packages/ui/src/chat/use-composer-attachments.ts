"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAttachmentDownload, ChatStoredFile, ChatThread, ChatThreadRecord } from "./chat-display";
import type { AttachmentControls, ComposerAttachment } from "./composer";

/** How a portal moves files into a conversation. Each transfer returns the attachment id the message will carry. */
export type ChatAttachmentSource = {
  uploadAttachment?(thread: ChatThreadRecord, file: File): Promise<string>;
  copyAttachment?(thread: ChatThreadRecord, file: ChatStoredFile): Promise<string>;
  storedFiles?(thread: ChatThreadRecord): Promise<ChatStoredFile[]>;
  downloadAttachment?(attachmentId: string): Promise<ChatAttachmentDownload>;
};

type PendingAttachment = ComposerAttachment & { attachmentId?: string };
const NONE: PendingAttachment[] = [];

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

/**
 * The files on the message being written, per conversation. A file joins the message at once and is attached when its
 * transfer finishes; a failed one stays, with its reason, until it is removed.
 */
export function useComposerAttachments(source: ChatAttachmentSource, active: ChatThread | undefined) {
  const [pending, setPending] = useState<Record<string, PendingAttachment[]>>({});
  const latest = useRef(source);

  useEffect(() => {
    latest.current = source;
  });

  const update = useCallback((threadId: string, change: (items: PendingAttachment[]) => PendingAttachment[]) => {
    setPending((all) => ({ ...all, [threadId]: change(all[threadId] ?? NONE) }));
  }, []);

  async function attach(thread: ChatThread, name: string, transfer: () => Promise<string>) {
    if (thread.status === "closed") return;
    const key = crypto.randomUUID();
    update(thread.id, (items) => [...items, { key, name, status: "uploading" }]);
    const settle = (patch: Partial<PendingAttachment>) => update(thread.id, (items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    try {
      settle({ status: "attached", attachmentId: await transfer() });
    } catch (reason) {
      settle({ status: "failed", error: errorText(reason, "Unable to attach this file") });
    }
  }

  // Stable across renders, so a message's image preview is fetched once rather than on every render.
  const downloadAttachment = useCallback((attachmentId: string) => {
    const download = latest.current.downloadAttachment;
    return download ? download(attachmentId) : Promise.reject(new Error("Downloads are not available"));
  }, []);

  /** The attachment ids ready to send with this conversation's message. */
  function readyIds(threadId: string) {
    return (pending[threadId] ?? NONE).flatMap((item) => (item.status === "attached" && item.attachmentId ? [item.attachmentId] : []));
  }

  function controlsFor(thread: ChatThread): Partial<AttachmentControls> {
    return {
      attachments: pending[thread.id] ?? NONE,
      canAttach: Boolean(source.uploadAttachment) && thread.status !== "closed",
      onAttachFile: (file) => {
        const upload = latest.current.uploadAttachment;
        if (upload) void attach(thread, file.name, () => upload(thread, file));
      },
      onAttachStoredFile: (file) => {
        const copy = latest.current.copyAttachment;
        if (copy) void attach(thread, file.originalFileName, () => copy(thread, file));
      },
      onListStoredFiles: source.storedFiles ? () => latest.current.storedFiles?.(thread) ?? Promise.resolve([]) : undefined,
      onRemoveAttachment: (key) => update(thread.id, (items) => items.filter((item) => item.key !== key)),
    };
  }

  return {
    readyIds,
    isUploading: (threadId: string) => (pending[threadId] ?? NONE).some((item) => item.status === "uploading"),
    /** After a send, the files it carried leave the composer; failed ones stay so the writer sees them. */
    clearSent: (threadId: string) => update(threadId, (items) => items.filter((item) => item.status !== "attached")),
    controls: { ...(active ? controlsFor(active) : { attachments: NONE, canAttach: false }), downloadAttachment },
  };
}
