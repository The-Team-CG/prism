import { useEffect, useRef, type KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { COMMUNICATION_MESSAGE_ATTACHMENT_LIMIT } from "@prism/types";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import type { ChatStoredFile } from "./chat-display";
import { AttachButton, AttachmentChips } from "./composer-attachments";

/** A file on the message being written. It is attached once its transfer finishes; only then can the message carry it. */
export type ComposerAttachment = { key: string; name: string; status: "uploading" | "attached" | "failed"; error?: string };

/** Attaching is offered only in an open conversation; the portal supplies the transfers and the picker's list. */
export type AttachmentControls = {
  attachments: ComposerAttachment[];
  canAttach: boolean;
  onAttachFile: (file: File) => void;
  onAttachStoredFile: (file: ChatStoredFile) => void;
  onListStoredFiles: () => Promise<ChatStoredFile[]>;
  onRemoveAttachment: (key: string) => void;
};

export type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error?: string | null;
  placeholder: string;
  /** With a hardware keyboard Enter sends; on a phone it starts a new line and the button sends. */
  enterSends: boolean;
} & Partial<AttachmentControls>;

/** A message can go once nothing is still uploading and it has text or an attached file. */
function sendable(draft: string, busy: boolean, attachments: ComposerAttachment[]) {
  if (busy || attachments.some((item) => item.status === "uploading")) return false;
  return draft.trim().length > 0 || attachments.some((item) => item.status === "attached");
}

/** More files can join while the conversation allows it, the portal can move them, and the message is under its limit. */
function attachable(props: Partial<AttachmentControls>, count: number) {
  return Boolean(props.canAttach && props.onAttachFile && props.onAttachStoredFile && props.onListStoredFiles) && count < COMMUNICATION_MESSAGE_ATTACHMENT_LIMIT;
}

export function Composer({ draft, onDraftChange, onSend, busy, error, placeholder, enterSends, attachments = [], ...files }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = sendable(draft, busy, attachments);
  const { onAttachFile, onAttachStoredFile, onListStoredFiles, onRemoveAttachment } = files;

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft]);

  function onKeyDown(input: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && input.key === "Enter" && !input.shiftKey && !input.nativeEvent.isComposing) {
      input.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
      {attachments.length ? <AttachmentChips attachments={attachments} onRemove={onRemoveAttachment} /> : null}
      <div className="flex items-end gap-2">
        {attachable(files, attachments.length) ? <AttachButton onAttachFile={onAttachFile!} onAttachStoredFile={onAttachStoredFile!} onListStoredFiles={onListStoredFiles!} /> : null}
        <Textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(input) => onDraftChange(input.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-40 min-h-10 flex-1 rounded-2xl leading-5 shadow-none"
        />
        <Button type="button" size="icon" disabled={!canSend} onClick={onSend} className="rounded-full" aria-label="Send message">
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
      {enterSends ? <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p> : null}
    </div>
  );
}
