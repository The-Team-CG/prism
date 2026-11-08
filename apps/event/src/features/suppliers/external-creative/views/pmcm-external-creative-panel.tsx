"use client";

import { useState } from "react";
import type { PrismDocument, PrismExternalCreativeTicket } from "@prism/types";
import { useExternalCreative } from "../view-models/use-external-creative";

const FIELD = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const STATUS_LABEL: Record<PrismExternalCreativeTicket["status"], string> = { requested: "Requested", in_progress: "In progress", delivered: "Delivered", completed: "Completed" };

/** FR-87: outsourced creative designers are tracked by PMCM only; no supplier entry or portal account. */
export function PmcmExternalCreativePanel({ eventId, documents }: { eventId: string; documents: PrismDocument[] }) {
  const vm = useExternalCreative(eventId);
  const [form, setForm] = useState({ designerName: "", designerContact: "", deliverable: "", dueDate: "" });
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="external-creative-heading">
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
        <div className="self-end"><button type="submit" disabled={vm.busy || !form.designerName.trim() || !form.deliverable.trim()} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Open ticket</button></div>
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
            <button type="button" disabled={busy} onClick={() => void onUpdate(ticket.id, "in_progress", note)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">In progress</button>
            <button type="button" disabled={busy} onClick={() => void onUpdate(ticket.id, "delivered", note)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Delivered</button>
          </div>
          <label className="text-xs">Finished output in event files
            <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className={FIELD}>
              <option value="">Choose a file</option>
              {documents.map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}
            </select>
          </label>
          <div className="flex items-end"><button type="button" disabled={busy || !documentId} onClick={() => void onComplete(ticket.id, documentId)} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Mark complete</button></div>
        </div>
      )}
    </li>
  );
}
