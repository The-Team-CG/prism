import { useEffect, useRef, type KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

export type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error?: string | null;
  placeholder: string;
  /** With a hardware keyboard Enter sends; on a phone it starts a new line and the button sends. */
  enterSends: boolean;
};

export function Composer({ draft, onDraftChange, onSend, busy, error, placeholder, enterSends }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft]);

  function onKeyDown(input: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && input.key === "Enter" && !input.shiftKey && !input.nativeEvent.isComposing) {
      input.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="flex items-end gap-2">
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
        <Button type="button" size="icon" disabled={!draft.trim() || busy} onClick={onSend} className="rounded-full" aria-label="Send message">
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
      {enterSends ? <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p> : null}
    </div>
  );
}
