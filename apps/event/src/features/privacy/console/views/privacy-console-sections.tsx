"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import type { PrismPrivacyLegalHold, PrismPrivacyRequest, PrismUser } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { compactTimestamp, cx, label, Panel } from "@/features/pmcm-kit";
import { privacyDeadlineLabel } from "../model/privacy-console-rules";
import type { PrivacyCorrectionDraft } from "../model/privacy-correction";
import type { PrivacyConsoleViewModel } from "../view-models/use-privacy-console-view-model";

const selectClassName = "h-10 rounded-md border border-border bg-white px-3 text-sm";

export function PrivacyFilterBar({ vm }: { vm: PrivacyConsoleViewModel }) {
  const { filters } = vm;
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-6">
      <select aria-label="Filter by event" value={filters.eventId} onChange={(event) => vm.updateFilters({ eventId: event.target.value })} className={selectClassName}>
        <option value="all">All events</option>
        {vm.events.map((event) => <option key={event.id} value={event.id}>{event.eventName}</option>)}
      </select>
      <select aria-label="Filter by status" value={filters.status} onChange={(event) => vm.updateFilters({ status: event.target.value as typeof filters.status })} className={selectClassName}>
        <option value="all">All statuses</option>
        <option value="open">Open (submitted or approved)</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="executed">Executed</option>
        <option value="rejected">Rejected</option>
      </select>
      <select aria-label="Filter by request type" value={filters.requestType} onChange={(event) => vm.updateFilters({ requestType: event.target.value as typeof filters.requestType })} className={selectClassName}>
        <option value="all">All request types</option>
        <option value="access">Access</option>
        <option value="correction">Correction</option>
        <option value="deletion">Deletion</option>
        <option value="export">Export</option>
      </select>
      <select aria-label="Filter by subject type" value={filters.subjectType} onChange={(event) => vm.updateFilters({ subjectType: event.target.value as typeof filters.subjectType })} className={selectClassName}>
        <option value="all">All subjects</option>
        <option value="client">Client</option>
        <option value="supplier">Supplier</option>
        <option value="guest">Guest</option>
        <option value="account">Account</option>
      </select>
      <select aria-label="Filter by deadline" value={filters.deadline} onChange={(event) => vm.updateFilters({ deadline: event.target.value as typeof filters.deadline })} className={selectClassName}>
        <option value="all">Any deadline</option>
        <option value="overdue">Overdue</option>
        <option value="on-track">Within 30-day SLA</option>
      </select>
      <select aria-label="Filter by owner" value={filters.assignment} onChange={(event) => vm.updateFilters({ assignment: event.target.value as typeof filters.assignment })} className={selectClassName}>
        <option value="all">Any owner</option>
        <option value="mine">Assigned to me</option>
        <option value="unassigned">Unassigned</option>
      </select>
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
      <p className={cx("mt-2 text-xs", request.overdue ? "font-black text-red-700" : "text-muted-foreground")}>
        {privacyDeadlineLabel(request, vm.now)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Owner: {owner} · Logged {compactTimestamp(request.createdAt)}</p>
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
    <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
      <select
        aria-label="Subject type for new request"
        value={form.subjectType}
        onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectType: event.target.value as typeof form.subjectType }))}
        className={selectClassName}
      >
        <option value="client">Client</option>
        <option value="supplier">Supplier</option>
        <option value="guest">Guest</option>
      </select>
      <select
        aria-label="Request type for new request"
        value={form.requestType}
        onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, requestType: event.target.value as typeof form.requestType }))}
        className={selectClassName}
      >
        <option value="access">Access</option>
        <option value="correction">Correction</option>
        <option value="deletion">Deletion</option>
        <option value="export">Export</option>
      </select>
      <Input aria-label="New request subject email" value={form.subjectEmail} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectEmail: event.target.value }))} className="h-10 bg-white" placeholder="Subject email" />
      <Input aria-label="New request subject name" value={form.subjectName} onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, subjectName: event.target.value }))} className="h-10 bg-white" placeholder="Subject name" />
      <textarea
        aria-label="New request notes"
        value={form.requestNotes}
        onChange={(event) => vm.setPrivacyForm((current) => ({ ...current, requestNotes: event.target.value }))}
        className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm sm:col-span-2"
        placeholder="Request notes"
      />
      <Button type="button" disabled={vm.busy || (!form.subjectEmail && !form.subjectName)} onClick={vm.logPrivacyRequest} className="h-10 rounded-md font-black sm:col-span-2">
        Log privacy request
      </Button>
    </div>
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
        <select
          aria-label="Legal hold subject type"
          value={form.subjectType}
          onChange={(event) => vm.setLegalHoldForm((current) => ({ ...current, subjectType: event.target.value as typeof current.subjectType }))}
          className={selectClassName}
        >
          <option value="client">Client</option>
          <option value="supplier">Supplier</option>
          <option value="guest">Guest</option>
        </select>
        <select
          aria-label="Legal hold event scope"
          value={form.eventScope}
          onChange={(event) => vm.setLegalHoldForm((current) => ({ ...current, eventScope: event.target.value as typeof current.eventScope }))}
          className={selectClassName}
        >
          <option value="subject">All events for this subject</option>
          <option value="event" disabled={vm.filters.eventId === "all"}>Selected event only</option>
        </select>
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
        <Button
          type="button"
          disabled={vm.busy || !(identity ?? "").trim() || !form.reason.trim() || (eventScope && vm.filters.eventId === "all")}
          onClick={vm.placePrivacyLegalHold}
          className="h-10 rounded-md font-black sm:col-span-2"
        >
          Place legal hold
        </Button>
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
