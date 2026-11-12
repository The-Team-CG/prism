import { Check, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Field, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { cn } from "../utils";
import { ChatAvatar } from "./chat-avatar";
import { roleName, type ChatPerson } from "./chat-display";
import { BackButton } from "./conversation";

/** Starting a conversation is optional: only portals whose actors may open threads pass this. */
export type ChatCompose = {
  open: boolean;
  onStart: () => void;
  onCancel: () => void;
  contextLabel: string;
  subject: string;
  onSubjectChange: (value: string) => void;
  onCreate: () => void;
  /** Set when the list spans several events: a new conversation has to name the one it is about. */
  event?: { options: Array<{ id: string; label: string }>; value?: string; onChange: (id: string) => void };
} & (
  | { participants: ChatPerson[]; selected: string[]; onToggle: (id: string) => void }
  /** The actor cannot choose people: the conversation goes to this named recipient. */
  | { recipient: string }
);

export function NewConversation({ compose, canCancel, busy, error, onBack }: { compose: ChatCompose; canCancel: boolean; busy: boolean; error?: string | null; onBack: () => void }) {
  const needsEvent = Boolean(compose.event && !compose.event.value);
  const needsPeople = "selected" in compose && compose.selected.length === 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
        <BackButton onBack={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="font-sans text-base font-semibold leading-tight text-foreground">New conversation</h2>
          <p className="truncate text-xs text-muted-foreground">{compose.contextLabel}</p>
        </div>
        {canCancel ? <Button type="button" variant="ghost" size="sm" onClick={compose.onCancel} className="shadow-none">Cancel</Button> : null}
      </header>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(submit) => {
          submit.preventDefault();
          compose.onCreate();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {compose.event ? (
            <Field>
              <FieldLabel htmlFor="chat-new-event">Event</FieldLabel>
              <Select value={compose.event.value} onValueChange={compose.event.onChange}>
                <SelectTrigger id="chat-new-event" className="h-10 w-full min-w-0">
                  <SelectValue placeholder="Choose an event" />
                </SelectTrigger>
                <SelectContent>
                  {compose.event.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="chat-new-topic">Topic</FieldLabel>
            <Input id="chat-new-topic" value={compose.subject} onChange={(input) => compose.onSubjectChange(input.target.value)} placeholder="e.g. Stage setup timing" />
          </Field>
          {"recipient" in compose ? (
            <p className="text-sm text-foreground"><span className="text-muted-foreground">To</span> {compose.recipient}</p>
          ) : (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium text-foreground">
                People <span className="font-normal text-muted-foreground">· {compose.selected.length} selected</span>
              </legend>
              {compose.participants.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  {needsEvent ? "Choose an event to see who can join." : "No verified participants yet."}
                </p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {compose.participants.map((person) => {
                    const selected = compose.selected.includes(person.id);
                    return (
                      <li key={person.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/60 has-[:focus-visible]:bg-muted">
                          <input type="checkbox" className="sr-only" checked={selected} onChange={() => compose.onToggle(person.id)} />
                          <ChatAvatar name={person.name} seed={person.id} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[person.role ? roleName(person.role) : null, person.email].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span aria-hidden className={cn("grid size-5 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                            {selected ? <Check className="size-3" /> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button type="submit" disabled={!compose.subject.trim() || needsEvent || needsPeople || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MessageSquareText />}
            Start conversation
          </Button>
        </div>
      </form>
    </div>
  );
}
