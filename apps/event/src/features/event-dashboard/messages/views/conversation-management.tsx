"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { PrismCommunicationParticipantChoice } from "@prism/types";
import { roleName, type ChatThread } from "@prism/ui/chat";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@prism/ui/components/sheet";
import { addableChoices, removalBlocker } from "../model/conversation-members";
import type { EventMessageManage } from "../view-models/use-event-messages-view-model";

function errorText(reason: unknown) {
  return reason instanceof Error ? reason.message : "Something went wrong. Try again.";
}

/** Runs one change, showing its refusal in place rather than failing silently. */
function useChange() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(change: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await change();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

/** PMCM's People sheet for an open conversation: who is in it, removing and adding people, and closing it. */
export function ConversationPeopleSheet({ thread, manage }: { thread: ChatThread; manage: EventMessageManage }) {
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState<PrismCommunicationParticipantChoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const change = useChange();
  const members = thread.participants;
  const choices = addableChoices(eligible, members);
  const closed = thread.status === "closed";

  // The eligible list is fetched when the sheet opens, so it reflects who can join now.
  useEffect(() => {
    if (!open || !thread.eventId) return;
    let cancelled = false;
    void manage.eligible(thread.eventId).then((next) => {
      if (!cancelled) setEligible(next);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, thread.eventId, manage]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shadow-none">
          <Users />
          People
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>People in {thread.subject}</SheetTitle>
          <SheetDescription>Members see each other&apos;s names. Emails stay private.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-4">
          <section aria-label="Members" className="space-y-2">
            <ul className="space-y-2">
              {members.map((member) => {
                const blocker = removalBlocker(members, member.actorId);
                const name = member.name?.trim() || roleName(member.actorRole);
                return (
                  <li key={member.actorId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {name} <span className="text-xs text-muted-foreground">{roleName(member.actorRole)}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="shadow-none" disabled={change.busy || Boolean(blocker)} title={blocker} onClick={() => void change.run(() => manage.removePerson(thread, member.actorId))}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Add people" className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Add people</h3>
            {choices.length ? (
              <ul className="space-y-1">
                {choices.map((person) => (
                  <li key={person.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={selected.includes(person.id)}
                        onChange={() => setSelected((current) => (current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id]))}
                      />
                      <span className="min-w-0 truncate">{person.name?.trim() || roleName(person.role)}</span>
                      <span className="text-xs text-muted-foreground">{roleName(person.role)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Everyone eligible for this event is already here.</p>
            )}
            <p className="text-xs text-muted-foreground">They&apos;ll see earlier messages in this conversation.</p>
            <Button
              type="button"
              size="sm"
              className="shadow-none"
              disabled={change.busy || selected.length === 0}
              onClick={() =>
                void change.run(async () => {
                  await manage.addPeople(thread, selected);
                  setSelected([]);
                })
              }
            >
              Add people
            </Button>
          </section>

          {change.error ? <p role="alert" className="text-xs text-danger">{change.error}</p> : null}
        </div>
        <SheetFooter>
          {closed ? (
            <Button type="button" variant="outline" className="shadow-none" disabled={change.busy} onClick={() => void change.run(() => manage.setStatus(thread, "open"))}>
              Reopen conversation
            </Button>
          ) : (
            <Button type="button" variant="outline" className="shadow-none" disabled={change.busy} onClick={() => void change.run(() => manage.setStatus(thread, "closed"))}>
              Close conversation
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Reopens a closed conversation from its closed note. */
export function ReopenConversationButton({ thread, manage }: { thread: ChatThread; manage: EventMessageManage }) {
  const change = useChange();
  return (
    <div className="flex items-center gap-2">
      {change.error ? <span role="alert" className="text-xs text-danger">{change.error}</span> : null}
      <Button type="button" variant="outline" size="sm" className="shadow-none" disabled={change.busy} onClick={() => void change.run(() => manage.setStatus(thread, "open"))}>
        Reopen
      </Button>
    </div>
  );
}
