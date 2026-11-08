"use client";

import { formatPortalDateTime } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { useInquiryEditViewModel } from "../view-models/use-inquiry-edit-view-model";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/** FR-50: change an inquiry within 24 hours of sending it, until PMCM reviews it. */
export function InquiryEditView({ token }: { token: string }) {
  const vm = useInquiryEditViewModel(token);
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-12 text-foreground">
      <h1 className="font-heading text-2xl font-bold">Edit your inquiry</h1>
      {vm.status === "loading" ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {vm.error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{vm.error}</p> : null}
      {vm.inquiry && vm.status !== "closed" ? (
        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void vm.save(); }}>
          <p className="text-sm text-muted-foreground">You can make changes until {formatPortalDateTime(vm.inquiry.editableUntil)}, or until PMCM reviews your inquiry.</p>
          <label className="block text-sm font-semibold">Event name<input required value={vm.form.eventName} onChange={(event) => vm.setField("eventName", event.target.value)} className={field} /></label>
          <label className="block text-sm font-semibold">Event type<input value={vm.form.eventType} onChange={(event) => vm.setField("eventType", event.target.value)} className={field} /></label>
          <label className="block text-sm font-semibold">Event date<input required type="date" value={vm.form.eventDate} onChange={(event) => vm.setField("eventDate", event.target.value)} className={field} /></label>
          <label className="block text-sm font-semibold">Message to PMCM<textarea required rows={5} value={vm.form.message} onChange={(event) => vm.setField("message", event.target.value)} className={field} /></label>
          <label className="block text-sm font-semibold">Room set-up notes<textarea rows={2} maxLength={500} value={vm.form.setupNotes} onChange={(event) => vm.setField("setupNotes", event.target.value)} className={field} /></label>
          <Button type="submit" disabled={vm.status === "saving"}>{vm.status === "saving" ? "Saving…" : "Save changes"}</Button>
          {vm.status === "saved" ? <p role="status" className="text-sm text-foreground">Your changes are saved. PMCM will see the updated inquiry.</p> : null}
        </form>
      ) : null}
    </main>
  );
}
