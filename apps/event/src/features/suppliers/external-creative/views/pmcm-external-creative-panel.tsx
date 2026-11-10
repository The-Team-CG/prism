"use client";

import { useState } from "react";
import type { PrismDocument, PrismExternalCreativeTicket } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { useExternalCreative } from "../view-models/use-external-creative";

const FIELD = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const STATUS_LABEL: Record<PrismExternalCreativeTicket["status"], string> = { requested: "Requested", in_progress: "In progress", delivered: "Delivered", completed: "Completed" };
/** Radix Select cannot hold an empty-string item, so "none" stands for "no file chosen yet". */
const NO_FILE = "none";

/** FR-87: outsourced creative designers are tracked by PMCM only; no supplier entry or portal account. */
export function PmcmExternalCreativePanel({ eventId, documents }: { eventId: string; documents: PrismDocument[] }) {
  const vm = useExternalCreative(eventId);
  const [form, setForm] = useState({ designerName: "", designerContact: "", deliverable: "", dueDate: "" });
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="external-creative-heading">
      <h2 id="external-creative-heading" className="font-semibold text-foreground">Outsourced creative</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Track an external designer's deliverable. Upload the finished file to the event's files, then complete the ticket against it.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      <ul className="mt-4 space-y-3">
        {vm.tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} documents={documents} busy={vm.busy} onUpdate={vm.update} onComplete={vm.complete} />)}
      </ul>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void vm.create(form).then((ok) => { if (ok) setForm({ designerName: "", designerContact: "", deliverable: "", dueDate: "" }); }); }}>
        <label className="text-sm">Designer<input value={form.designerName} onChange={(event) => set("designerName")(event.target.value)} className={FIELD} /></label>
        <label className="text-sm">Contact<input value={form.designerContact} onChange={(event) => set("designerContact")(event.target.value)} className={FIELD} /></label>
        <label className="text-sm md:col-span-2">Deliverable<textarea rows={2} value={form.deliverable} onChange={(event) => set("deliverable")(event.target.value)} className={FIELD} /></label>
        <label className="text-sm">Due date<input type="date" value={form.dueDate} onChange={(event) => set("dueDate")(event.target.value)} className={FIELD} /></label>
        <div className="self-end">
          <Button type="submit" size="sm" disabled={vm.busy || !form.designerName.trim() || !form.deliverable.trim()}>Open ticket</Button>
          {!form.designerName.trim() || !form.deliverable.trim() ? <p className="mt-2 text-xs text-muted-foreground">Add a designer and deliverable to open the ticket.</p> : null}
        </div>
      </form>
    </section>
  );
}

function TicketRow({ ticket, documents, busy, onUpdate, onComplete }: {
  ticket: PrismExternalCreativeTicket;
  documents: PrismDocument[];
  busy: boolean;
  onUpdate: (ticketId: string, status: "in_progress" | "delivered", note: string) => Promise<boolean>;
  onComplete: (ticketId: string, documentId: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState(ticket.progressNote);
  const [documentId, setDocumentId] = useState("");
  const done = ticket.status === "completed";
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <p className="font-semibold">{ticket.designerName} · {STATUS_LABEL[ticket.status]}{ticket.dueDate ? ` · due ${ticket.dueDate}` : ""}</p>
      <p className="text-muted-foreground">{ticket.deliverable}</p>
      {done ? <p className="mt-1 text-xs text-muted-foreground">Output: {ticket.outputFileName} · completed by {ticket.completedBy}</p> : (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="text-xs">Progress note<input value={note} onChange={(event) => setNote(event.target.value)} className={FIELD} /></label>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onUpdate(ticket.id, "in_progress", note)}>In progress</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onUpdate(ticket.id, "delivered", note)}>Delivered</Button>
          </div>
          <div className="grid gap-1 text-xs">
            <span id={`finished-output-${ticket.id}`}>Finished output in event files</span>
            <Select value={documentId || NO_FILE} onValueChange={(next) => setDocumentId(next === NO_FILE ? "" : next)}>
              <SelectTrigger aria-labelledby={`finished-output-${ticket.id}`} className="mt-1 h-9 w-full min-w-0 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FILE}>Choose a file</SelectItem>
                {documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.fileName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button type="button" size="sm" disabled={busy || !documentId} onClick={() => void onComplete(ticket.id, documentId)}>Mark complete</Button></div>
        </div>
      )}
    </li>
  );
}
