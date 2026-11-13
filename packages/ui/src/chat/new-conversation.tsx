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
  const blocked = !compose.subject.trim() || needsEvent || needsPeople;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NewConversationHeader contextLabel={compose.contextLabel} canCancel={canCancel} onBack={onBack} onCancel={compose.onCancel} />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(submit) => {
          submit.preventDefault();
          compose.onCreate();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {compose.event ? <EventField event={compose.event} /> : null}
          <Field>
            <FieldLabel htmlFor="chat-new-topic">Topic</FieldLabel>
            <Input id="chat-new-topic" value={compose.subject} onChange={(input) => compose.onSubjectChange(input.target.value)} placeholder="e.g. Stage setup timing" />
          </Field>
          {"recipient" in compose ? (
            <p className="text-sm text-foreground"><span className="text-muted-foreground">To</span> {compose.recipient}</p>
          ) : (
            <PeopleField participants={compose.participants} selected={compose.selected} onToggle={compose.onToggle} needsEvent={needsEvent} />
          )}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button type="submit" disabled={blocked || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MessageSquareText />}
            Start conversation
          </Button>
        </div>
      </form>
    </div>
  );
}

function NewConversationHeader({ contextLabel, canCancel, onBack, onCancel }: { contextLabel: string; canCancel: boolean; onBack: () => void; onCancel: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
      <BackButton onBack={onBack} />
      <div className="min-w-0 flex-1">
        <h2 className="font-sans text-base font-semibold leading-tight text-foreground">New conversation</h2>
        <p className="truncate text-xs text-muted-foreground">{contextLabel}</p>
      </div>
      {canCancel ? <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="shadow-none">Cancel</Button> : null}
    </header>
  );
}

function EventField({ event }: { event: NonNullable<ChatCompose["event"]> }) {
  return (
    <Field>
      <FieldLabel htmlFor="chat-new-event">Event</FieldLabel>
      <Select value={event.value} onValueChange={event.onChange}>
        <SelectTrigger id="chat-new-event" className="h-10 w-full min-w-0">
          <SelectValue placeholder="Choose an event" />
        </SelectTrigger>
        <SelectContent>
          {event.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

function PeopleField({ participants, selected, onToggle, needsEvent }: { participants: ChatPerson[]; selected: string[]; onToggle: (id: string) => void; needsEvent: boolean }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        People <span className="font-normal text-muted-foreground">· {selected.length} selected</span>
      </legend>
      {participants.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {needsEvent ? "Choose an event to see who can join." : "No verified participants yet."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {participants.map((person) => (
            <ParticipantRow key={person.id} person={person} selected={selected.includes(person.id)} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function ParticipantRow({ person, selected, onToggle }: { person: ChatPerson; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/60 has-[:focus-visible]:bg-muted">
        <input type="checkbox" className="sr-only" checked={selected} onChange={() => onToggle(person.id)} />
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
}
