"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { createInquiryContextNoteSchema, INQUIRY_CONTEXT_NOTE_KINDS, INQUIRY_CONTEXT_NOTE_LABELS, parseContract, type PrismInquiryContextNote } from "@prism/types";
import { contextNotesRepository } from "../data/context-notes-repository";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

type Kind = (typeof INQUIRY_CONTEXT_NOTE_KINDS)[number];
const field = "mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

export function ContextNoteList({ notes }: { notes: PrismInquiryContextNote[] }) {
  if (notes.length === 0) return <p className="text-muted-foreground">No pre-conforme notes.</p>;
  return (
    <ul className="space-y-1">
      {notes.map((note) => (
        <li key={note.id}><span className="font-semibold">{INQUIRY_CONTEXT_NOTE_LABELS[note.kind]}</span>{note.followUpAt ? ` (due ${formatPortalDateTime(note.followUpAt)})` : ""}: {note.body} <span className="text-muted-foreground">· {note.createdBy}</span></li>
      ))}
    </ul>
  );
}

/** FR-53: PMCM logs discussion notes, scope flags and follow-ups before the conforme; they carry into the event workspace. */
export function ContextNotesLog({ inquiryId }: { inquiryId: string }) {
  const [notes, setNotes] = useState<PrismInquiryContextNote[]>([]);
  const [kind, setKind] = useState<Kind>("discussion");
  const [body, setBody] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setNotes(await contextNotesRepository.list(inquiryId)); } catch { setNotes([]); }
  }, [inquiryId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setError(null);
    try {
      const input = parseContract(createInquiryContextNoteSchema, { kind, body, ...(kind === "follow_up" && followUpAt ? { followUpAt } : {}) }, "Pre-conforme note");
      await contextNotesRepository.add(inquiryId, input);
      setBody("");
      setFollowUpAt("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the note.");
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
      <p className="font-semibold text-foreground">Pre-conforme notes</p>
      <ContextNoteList notes={notes} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <span>Type</span>
          <Select value={kind} onValueChange={(value) => { const next = INQUIRY_CONTEXT_NOTE_KINDS.find((candidate) => candidate === value); if (next) setKind(next); }}>
            <SelectTrigger aria-label="Note type" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INQUIRY_CONTEXT_NOTE_KINDS.map((value) => <SelectItem key={value} value={value}>{INQUIRY_CONTEXT_NOTE_LABELS[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {kind === "follow_up" ? <label>Follow up on<input type="date" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className={field} /></label> : null}
        <label className="grow">Note<input value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} className={field} /></label>
        <button type="button" disabled={!body.trim()} onClick={() => void add()} className="rounded-md border border-border px-3 py-1.5 font-semibold disabled:opacity-50">Add</button>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    </div>
  );
}

/** FR-53: the inquiry's notes, read-only, inside the event workspace. */
export function PreConformeContextPanel({ eventId }: { eventId: string }) {
  const [notes, setNotes] = useState<PrismInquiryContextNote[] | null>(null);
  useEffect(() => {
    void contextNotesRepository.forEvent(eventId).then(setNotes).catch(() => setNotes([]));
  }, [eventId]);
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="text-lg font-bold">Pre-conforme context</h2>
      <p className="mt-1 text-muted-foreground">Notes, scope flags and follow-ups PMCM logged on the inquiry before the conforme.</p>
      <div className="mt-3">{notes ? <ContextNoteList notes={notes} /> : <p className="text-muted-foreground">Loading…</p>}</div>
    </section>
  );
}
