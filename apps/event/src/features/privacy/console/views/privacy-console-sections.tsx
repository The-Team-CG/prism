"use client";

import { useId, useState, type ReactNode } from "react";
import { Database } from "lucide-react";
import type { PrismPrivacyLegalHold, PrismPrivacyRequest, PrismUser } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldGroup } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { compactTimestamp, cx, label, Panel } from "@/features/pmcm-kit";
import { privacyDeadlineLabel } from "../model/privacy-console-rules";
import type { PrivacyCorrectionDraft } from "../model/privacy-correction";
import type { PrivacyConsoleViewModel } from "../view-models/use-privacy-console-view-model";

export function PrivacyFilterBar({ vm }: { vm: PrivacyConsoleViewModel }) {
  const { filters } = vm;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold sm:hidden">
        {open ? "Hide filters" : "Filters"}
      </button>
      <div className={cx("min-w-0 gap-3 rounded-md border border-border bg-background p-3 sm:grid sm:grid-cols-2 xl:grid-cols-3", open ? "grid" : "hidden")}>
      <FilterSelect label="Event" value={filters.eventId} onChange={(value) => vm.updateFilters({ eventId: value })}>
        <SelectItem value="all">All events</SelectItem>
        {vm.events.map((event) => <SelectItem key={event.id} value={event.id}>{event.eventName}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Status" value={filters.status} onChange={(value) => vm.updateFilters({ status: value as typeof filters.status })}>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="open">Open (submitted or approved)</SelectItem>
        <SelectItem value="submitted">Submitted</SelectItem>
        <SelectItem value="approved">Approved</SelectItem>
        <SelectItem value="executed">Executed</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
      </FilterSelect>
      <FilterSelect label="Request type" value={filters.requestType} onChange={(value) => vm.updateFilters({ requestType: value as typeof filters.requestType })}>
        <SelectItem value="all">All request types</SelectItem>
        <SelectItem value="access">Access</SelectItem>
        <SelectItem value="correction">Correction</SelectItem>
        <SelectItem value="deletion">Deletion</SelectItem>
        <SelectItem value="export">Export</SelectItem>
      </FilterSelect>
      <FilterSelect label="Subject" value={filters.subjectType} onChange={(value) => vm.updateFilters({ subjectType: value as typeof filters.subjectType })}>
        <SelectItem value="all">All subjects</SelectItem>
        <SelectItem value="client">Client</SelectItem>
        <SelectItem value="supplier">Supplier</SelectItem>
        <SelectItem value="guest">Guest</SelectItem>
        <SelectItem value="account">Account</SelectItem>
      </FilterSelect>
      <FilterSelect label="Deadline" value={filters.deadline} onChange={(value) => vm.updateFilters({ deadline: value as typeof filters.deadline })}>
        <SelectItem value="all">Any deadline</SelectItem>
        <SelectItem value="overdue">Overdue</SelectItem>
        <SelectItem value="on-track">Within 30-day SLA</SelectItem>
      </FilterSelect>
      <FilterSelect label="Owner" value={filters.assignment} onChange={(value) => vm.updateFilters({ assignment: value as typeof filters.assignment })}>
        <SelectItem value="all">Any owner</SelectItem>
        <SelectItem value="mine">Assigned to me</SelectItem>
        <SelectItem value="unassigned">Unassigned</SelectItem>
      </FilterSelect>
      </div>
    </>
  );
}

/** A filter with a visible caption, so the choice is never a truncated value with no name. */
function FilterSelect({ label: caption, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{caption}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full min-w-0 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export function PrivacyQueuePager({ vm }: { vm: PrivacyConsoleViewModel }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {vm.total} request{vm.total === 1 ? "" : "s"} · page {vm.page + 1} of {vm.pageCount}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={vm.busy || vm.page === 0} onClick={() => vm.setPage((page) => Math.max(0, page - 1))}>
          Previous
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={vm.busy || !vm.hasMore} onClick={() => vm.setPage((page) => page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function requestOwnerLabel(request: PrismPrivacyRequest, vm: PrivacyConsoleViewModel) {
  if (!request.assignedTo) return "Unassigned";
  return vm.users.find((user: PrismUser) => user.id === request.assignedTo)?.name ?? request.assignedTo;
}

export function PrivacyRequestCard({ request, vm }: { request: PrismPrivacyRequest; vm: PrivacyConsoleViewModel }) {
  const owner = requestOwnerLabel(request, vm);
  const closed = request.status === "executed" || request.status === "rejected";
  const mine = Boolean(vm.operatorId) && request.assignedTo === vm.operatorId;
  return (
    <article className="rounded-md border border-border bg-background p-3 text-sm" aria-label={`${label(request.requestType)} request for ${request.subjectEmail || request.subjectName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black capitalize">{label(request.requestType)} request · {label(request.subjectType)}</p>
          <p className="mt-1 text-muted-foreground">{request.subjectEmail || request.subjectName || "Unnamed subject"}</p>
        </div>
        <p className="text-xs font-bold capitalize text-foreground">{label(request.status)}</p>
      </div>
      <p className={cx("mt-2 text-xs", request.overdue ? "font-black text-danger" : "text-muted-foreground")}>
        {privacyDeadlineLabel(request, vm.now)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {request.source === "self_service" ? "Self-service" : "PMCM-logged"} · Owner: {owner} · Logged {compactTimestamp(request.createdAt)}
      </p>
      {request.requestNotes ? <p className="mt-2 text-xs text-muted-foreground">{request.requestNotes}</p> : null}
      {closed ? null : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <AssignmentActions request={request} vm={vm} mine={mine} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><PrivacyRequestActions request={request} vm={vm} /></div>
        </>
      )}
    </article>
  );
}

function AssignmentActions({ request, vm, mine }: { request: PrismPrivacyRequest; vm: PrivacyConsoleViewModel; mine: boolean }) {
  if (!vm.isPmcmAdmin || !vm.operatorId) return null;
  return (
    <>
      {mine ? null : (
        <Button type="button" variant="outline" size="sm" disabled={vm.busy} onClick={() => vm.assignRequest(request.id, vm.operatorId)}>
          Assign to me
        </Button>
      )}
      {request.assignedTo ? (
        <Button type="button" variant="outline" size="sm" disabled={vm.busy} onClick={() => vm.assignRequest(request.id, null)}>
          Unassign
        </Button>
      ) : null}
    </>
  );
}

function PrivacyRequestActions({ request, vm }: { request: PrismPrivacyRequest; vm: PrivacyConsoleViewModel }) {
  if (request.status === "submitted") {
    return (
      <>
        <Button type="button" variant="outline" size="sm" disabled={vm.busy} onClick={() => vm.reviewPrivacyRequest(request.id, "approved")}>Approve</Button>
        <Button type="button" variant="outline" size="sm" disabled={vm.busy} onClick={() => vm.reviewPrivacyRequest(request.id, "rejected")}>Reject</Button>
      </>
    );
  }
  if (request.status !== "approved") return null;
  if (request.requestType === "correction") {
    return <PrivacyCorrectionForm busy={vm.busy} isGuest={request.subjectType === "guest"} onApply={(draft) => vm.executePrivacyRequest(request.id, draft)} />;
  }
  return <Button type="button" variant="outline" size="sm" disabled={vm.busy} onClick={() => vm.executePrivacyRequest(request.id)}>Execute</Button>;
}

export function PrivacyCorrectionForm({ busy, isGuest, onApply }: { busy: boolean; isGuest: boolean; onApply: (draft: PrivacyCorrectionDraft) => void }) {
  const [correctionDraft, setCorrectionDraft] = useState<PrivacyCorrectionDraft>({ name: "", email: "" });
  return (
    <div className="grid w-full gap-2 sm:grid-cols-2">
      <Input
        aria-label="Corrected name"
        placeholder="Corrected name (optional)"
        value={correctionDraft.name}
        disabled={busy}
        onChange={(event) => setCorrectionDraft((draft) => ({ ...draft, name: event.target.value }))}
      />
      <Input
        aria-label="Corrected email"
        placeholder={isGuest ? "Corrected roster email (optional)" : "Corrected email (optional)"}
        value={correctionDraft.email}
        disabled={busy}
        onChange={(event) => setCorrectionDraft((draft) => ({ ...draft, email: event.target.value }))}
      />
      <p className="text-xs text-muted-foreground sm:col-span-2">
        {isGuest
          ? "Guest corrections update this event's roster, check-in, and feedback rows for the subject name."
          : "Corrections change only the fields entered above."}
      </p>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onApply(correctionDraft)}>
        Apply correction
      </Button>
    </div>
  );
}

export function PrivacyLogRequestForm({ vm }: { vm: PrivacyConsoleViewModel }) {
  const form = vm.privacyForm;
  return (
    <FieldGroup className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
      <Select value={form.subjectType} onValueChange={(value) => vm.setPrivacyForm((current) => ({ ...current, subjectType: value as typeof form.subjectType }))}>
        <SelectTrigger aria-label="Subject type for new request" className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="client">Client</SelectItem>
          <SelectItem value="supplier">Supplier</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
          <SelectItem value="account">Native account</SelectItem>
        </SelectContent>
      </Select>
      <Select value={form.requestType} onValueChange={(value) => vm.setPrivacyForm((current) => ({ ...current, requestType: value as typeof form.requestType }))}>
        <SelectTrigger aria-label="Request type for new request" className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="access">Access</SelectItem>
          <SelectItem value="correction">Correction</SelectItem>
          <SelectItem value="deletion">Deletion</SelectItem>
          <SelectItem value="export">Export</SelectItem>
        </SelectContent>
      </Select>
      <Input aria-label="New request subject email" value={form.subjectEmail} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectEmail: event.target.value }))} placeholder="Subject email" />
      <Input aria-label="New request subject name" value={form.subjectName} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectName: event.target.value }))} placeholder="Subject name" />
      <Textarea
        aria-label="New request notes"
        value={form.requestNotes}
        onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, requestNotes: event.target.value }))}
        className="min-h-20 sm:col-span-2"
        placeholder="Request notes"
      />
      <Field className="sm:col-span-2">
        <div>
          <Button type="button" disabled={vm.busy || (!form.subjectEmail && !form.subjectName)} onClick={vm.logPrivacyRequest}>
            Log privacy request
          </Button>
        </div>
        {form.subjectEmail || form.subjectName ? null : <FieldDescription>Add a subject email or name to log the request.</FieldDescription>}
      </Field>
    </FieldGroup>
  );
}

export function PrivacyLegalHoldControls({ vm }: { vm: PrivacyConsoleViewModel }) {
  const form = vm.legalHoldForm;
  const eventScope = form.eventScope === "event";
  const identity = form.subjectType === "guest" ? form.subjectName : form.subjectEmail;
  return (
    <section className="space-y-3 rounded-md border border-border bg-background p-3" aria-labelledby="privacy-legal-holds-title">
      <div>
        <h3 id="privacy-legal-holds-title" className="font-black text-foreground">Legal holds</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Active holds stop matching deletion and correction requests. Guest identity uses the full name; an all-events hold applies to matching names across events.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={form.subjectType} onValueChange={(value) => vm.setLegalHoldForm((current) => ({ ...current, subjectType: value as typeof current.subjectType }))}>
          <SelectTrigger aria-label="Legal hold subject type" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="account">Native account</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.eventScope} onValueChange={(value) => vm.setLegalHoldForm((current) => ({ ...current, eventScope: value as typeof current.eventScope }))}>
          <SelectTrigger aria-label="Legal hold event scope" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subject">All events for this subject</SelectItem>
            <SelectItem value="event" disabled={vm.filters.eventId === "all"}>Selected event only</SelectItem>
          </SelectContent>
        </Select>
        {form.subjectType === "guest" ? (
          <Input
            aria-label="Guest name for legal hold"
            value={form.subjectName ?? ""}
            onChange={(event) => vm.setLegalHoldForm((current) => ({ ...current, subjectName: event.target.value }))}
            className="h-10 bg-white sm:col-span-2"
            placeholder="Full guest name"
          />
        ) : (
          <Input
            aria-label="Email identity for legal hold"
            value={form.subjectEmail ?? ""}
            onChange={(event) => vm.setLegalHoldForm((current) => ({ ...current, subjectEmail: event.target.value }))}
            className="h-10 bg-white sm:col-span-2"
            placeholder="Subject email"
          />
        )}
        <Input
          aria-label="Legal hold reason"
          value={form.reason}
          onChange={(event) => vm.setLegalHoldForm((current) => ({ ...current, reason: event.target.value }))}
          className="h-10 bg-white sm:col-span-2"
          placeholder="Reason for placing the hold"
        />
        <Field className="sm:col-span-2">
          <div>
            <Button
              type="button"
              disabled={vm.busy || !(identity ?? "").trim() || !form.reason.trim() || (eventScope && vm.filters.eventId === "all")}
              onClick={vm.placePrivacyLegalHold}
            >
              Place legal hold
            </Button>
          </div>
          {eventScope && vm.filters.eventId === "all" ? <FieldDescription>Choose a single event in the filters to hold for that event only.</FieldDescription> : null}
        </Field>
      </div>
      {vm.legalHolds.length === 0 ? <p className="text-sm text-muted-foreground">No active legal holds.</p> : null}
      <div className="space-y-2">
        {vm.legalHolds.map((hold) => (
          <PrivacyLegalHoldCard key={hold.id} hold={hold} vm={vm} />
        ))}
      </div>
    </section>
  );
}

function PrivacyLegalHoldCard({ hold, vm }: { hold: PrismPrivacyLegalHold; vm: PrivacyConsoleViewModel }) {
  const eventName = hold.eventId
    ? vm.events.find((event) => event.id === hold.eventId)?.eventName ?? hold.eventId
    : "All events";
  const releaseReason = vm.legalHoldReleaseReasons[hold.id] ?? "";
  return (
    <div className="rounded-md border border-border bg-white p-3 text-sm">
      <div>
        <p className="font-black capitalize">{hold.subjectType} · {hold.subjectEmail || hold.subjectName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{eventName} · Placed by {hold.placedByName} · {compactTimestamp(hold.placedAt)}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hold.reason}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label={`Release reason for ${hold.subjectEmail || hold.subjectName}`}
          value={releaseReason}
          onChange={(event) => vm.setLegalHoldReleaseReason(hold.id, event.target.value)}
          className="h-9 bg-white"
          placeholder="Reason for release"
        />
        <Button type="button" variant="outline" size="sm" disabled={vm.busy || !releaseReason.trim()} onClick={() => vm.releasePrivacyLegalHold(hold.id)}>
          Release hold
        </Button>
      </div>
    </div>
  );
}
