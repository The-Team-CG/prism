import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { formatAttachmentSize, type ChatStoredFile } from "./chat-display";
import type { ComposerAttachment } from "./composer";

/** The attach menu: a file from the device, or one already in the event's Files. */
export function AttachButton({ onAttachFile, onAttachStoredFile, onListStoredFiles }: { onAttachFile: (file: File) => void; onAttachStoredFile: (file: ChatStoredFile) => void; onListStoredFiles: () => Promise<ChatStoredFile[]> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full shadow-none" aria-label="Attach a file">
            <Paperclip />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>Upload from device</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPicking(true)}>Choose from Files</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Upload a file from this device"
        onChange={(input) => {
          Array.from(input.target.files ?? []).forEach(onAttachFile);
          input.target.value = "";
        }}
      />
      <StoredFilePicker open={picking} onOpenChange={setPicking} onList={onListStoredFiles} onPick={onAttachStoredFile} />
    </>
  );
}

/** The files on the message being written. A file that is still transferring shows that; a failed one stays until removed. */
export function AttachmentChips({ attachments, onRemove }: { attachments: ComposerAttachment[]; onRemove?: (key: string) => void }) {
  return (
    <ul aria-label="Attached files" className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((item) => (
        <li key={item.key} className="flex max-w-full items-center gap-1.5 rounded-xl bg-muted py-1 pl-2.5 pr-1 text-xs text-foreground">
          {item.status === "uploading" ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : <FileText className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{item.name}</span>
          <span className={item.status === "failed" ? "shrink-0 text-danger" : "shrink-0 text-muted-foreground"}>
            {item.status === "uploading" ? "Uploading…" : item.status === "failed" ? item.error ?? "Could not attach" : ""}
          </span>
          {onRemove ? (
            <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 rounded-full shadow-none" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}>
              <X />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type PickerState = { status: "loading" } | { status: "ready"; files: ChatStoredFile[] } | { status: "error" };

/** The event's stored files, listed when opened. Picking one copies it into the conversation. */
function StoredFilePicker({ open, onOpenChange, onList, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onList: () => Promise<ChatStoredFile[]>; onPick: (file: ChatStoredFile) => void }) {
  const [state, setState] = useState<PickerState>({ status: "loading" });
  useEffect(() => {
    if (!open) return;
    let current = true;
    setState({ status: "loading" });
    onList().then(
      (files) => current && setState({ status: "ready", files }),
      () => current && setState({ status: "error" }),
    );
    return () => {
      current = false;
    };
    // The list is fetched once per opening.
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose from Files</DialogTitle>
          <DialogDescription>A copy of the file joins this conversation. The original stays in Files.</DialogDescription>
        </DialogHeader>
        {state.status === "loading" ? <p className="text-sm text-muted-foreground">Loading files…</p> : null}
        {state.status === "error" ? <p role="alert" className="text-sm text-danger">Unable to load the event's files</p> : null}
        {state.status === "ready" && state.files.length === 0 ? <p className="text-sm text-muted-foreground">No files for this event yet.</p> : null}
        {state.status === "ready" && state.files.length ? (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {state.files.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onPick(file);
                    onOpenChange(false);
                  }}
                >
                  <span className="truncate">{file.originalFileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatAttachmentSize(file.declaredByteSize)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
