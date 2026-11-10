"use client";

import Link from "next/link";
import { ChevronLeft, FileWarning } from "lucide-react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { PrismBrandLogo } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";
import { useInquiryEditViewModel, type InquiryEditClosedReason } from "../view-models/use-inquiry-edit-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";

/** FR-50: change an inquiry within 24 hours of sending it, until PMCM reviews it. */
export function InquiryEditView({ token }: { token: string }) {
  const vm = useInquiryEditViewModel(token);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-2 px-5 sm:px-8">
        <Link href="/inquiry" aria-label="Back to inquiry" title="Back to inquiry" className="grid size-9 place-items-center rounded-lg text-primary transition-colors hover:bg-primary-soft">
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <PrismBrandLogo href="/" detail="Client portal" compact={false} />
      </header>
      <main className="mx-auto max-w-xl px-5 py-10 sm:py-12">
        {vm.status === "closed" ? <EditLinkClosed reason={vm.closedReason} /> : <EditForm vm={vm} />}
      </main>
    </div>
  );
}

function EditLinkClosed({ reason }: { reason: InquiryEditClosedReason }) {
  const unavailable = reason === "unavailable";
  return (
    <Empty className="gap-6 p-8 md:p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileWarning aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-semibold">
          <h1>{unavailable ? "We could not open your inquiry" : "This edit link can't be used"}</h1>
        </EmptyTitle>
        <EmptyDescription>
          {unavailable
            ? "Something went wrong on our side. Try the link again in a few minutes."
            : "The link is missing, invalid or older than 24 hours. Use the newest link in your email, or send a new inquiry."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline"><Link href="/inquiry">Back to inquiry</Link></Button>
      </EmptyContent>
    </Empty>
  );
}

type EditVm = ReturnType<typeof useInquiryEditViewModel>;

function EditForm({ vm }: { vm: EditVm }) {
  if (!vm.inquiry) {
    return <LoadingState label="Loading…" />;
  }
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void vm.save(); }}>
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold">Edit your inquiry</h1>
        <p className="text-sm text-muted-foreground">You can make changes until {formatPortalDateTime(vm.inquiry.editableUntil)}, or until PMCM reviews your inquiry.</p>
      </div>
      {vm.error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{vm.error}</p> : null}
      <Field>
        <FieldLabel htmlFor="inquiry-edit-event-name">Event name</FieldLabel>
        <Input id="inquiry-edit-event-name" required value={vm.form.eventName} onChange={(event) => vm.setField("eventName", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="inquiry-edit-event-type">Event type</FieldLabel>
        <Input id="inquiry-edit-event-type" value={vm.form.eventType} onChange={(event) => vm.setField("eventType", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="inquiry-edit-event-date">Event date</FieldLabel>
        <Input id="inquiry-edit-event-date" required type="date" value={vm.form.eventDate} onChange={(event) => vm.setField("eventDate", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="inquiry-edit-message">Message to PMCM</FieldLabel>
        <Textarea id="inquiry-edit-message" required rows={5} value={vm.form.message} onChange={(event) => vm.setField("message", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="inquiry-edit-setup-notes">Room set-up notes</FieldLabel>
        <Textarea id="inquiry-edit-setup-notes" rows={2} maxLength={500} value={vm.form.setupNotes} onChange={(event) => vm.setField("setupNotes", event.target.value)} />
        <FieldDescription>Up to 500 characters.</FieldDescription>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={vm.status === "saving"}>{vm.status === "saving" ? "Saving…" : "Save changes"}</Button>
        {vm.status === "saved" ? <p role="status" className="text-sm text-foreground">Your changes are saved. PMCM will see the updated inquiry.</p> : null}
      </div>
    </form>
  );
}
