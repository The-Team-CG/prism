"use client";
import { formatPortalDateTime, formatPortalTime } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader } from "@prism/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";

import type { FormEvent } from "react";
import type { PrismCoordinatorRegistrationEntry } from "@prism/types";
import { canCheckInRegistrationEntry, canFlagRegistrationEntry, canRejectRegistrationEntry, canVerifyRegistrationEntry } from "../model/registration-rules";
import { useCoordinatorRegistrationDeskViewModel } from "../view-models/use-coordinator-registration-desk-view-model";
import { QrScanCheckIn } from "@/features/registration/qr-passes/views/qr-scan-check-in";

const inputClass = "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

function checkedInLabel(entry: PrismCoordinatorRegistrationEntry): string {
  if (!entry.checkedInAt) return "Not checked in";
  const time = formatPortalTime(entry.checkedInAt, "");
  return time ? `Checked in at ${time}` : "Checked in";
}

function verificationLabel(entry: PrismCoordinatorRegistrationEntry): string {
  if (!entry.verificationFlaggedAt) return entry.verificationStatus;
  return `Flagged for verification by ${entry.verificationFlaggedBy ?? "registration staff"}`;
}

function submittedLabel(entry: PrismCoordinatorRegistrationEntry): string {
  return formatPortalDateTime(entry.reviewSubmittedAt, "—");
}

export function CoordinatorRegistrationDesk({
  eventId,
  guestAttendanceCount,
  onAttendanceChange,
}: {
  eventId: string;
  guestAttendanceCount?: number;
  onAttendanceChange?: () => Promise<void>;
}) {
  const vm = useCoordinatorRegistrationDeskViewModel(eventId, onAttendanceChange);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.search();
  }

  function submitWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.registerWalkIn();
  }

  return (
    <section id="coordinator-registration-desk" aria-labelledby="coordinator-registration-title" className="scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 py-4">
        <h2 id="coordinator-registration-title" className="text-base font-bold text-foreground">Registration desk</h2>
        <p className="mt-1 text-sm text-muted-foreground">Search assigned-event guests, verify roster details, and record arrivals.</p>
        <p className="mt-2 text-sm font-semibold text-foreground" aria-live="polite" aria-atomic="true">
          {guestAttendanceCount === undefined ? "Attendance count unavailable." : `${guestAttendanceCount} guests checked in.`}
        </p>
        <div className="mt-3"><QrScanCheckIn key={`scan-${eventId}`} eventId={eventId} onCheckedIn={() => void onAttendanceChange?.()} /></div>
      </header>

      <div className="space-y-6 px-5 py-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="coordinator-registration-search">Search guest roster</label>
          <input
            id="coordinator-registration-search"
            className={inputClass}
            value={vm.query}
            onChange={(event) => vm.setQuery(event.target.value)}
            placeholder="Search guest names"
            autoComplete="off"
          />
          <Button variant="outline" className="h-10 sm:min-w-36" type="submit" disabled={vm.status === "loading" || vm.query.trim().length < 2}>
            {vm.status === "loading" ? "Searching…" : "Search guests"}
          </Button>
          <Button variant="outline" className="h-10" type="button" onClick={() => void vm.loadPendingReviews()} disabled={vm.status === "loading"}>
            Pending reviews
          </Button>
        </form>

        <RegistrationRoster vm={vm} />

        <form onSubmit={submitWalkIn} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Register a walk-in</h3>
            <p className="mt-1 text-xs text-muted-foreground">Walk-ins follow event policy and join the roster pending verification. Verify them before check-in.</p>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground" htmlFor="coordinator-walk-in-name">
            Guest name
            <input id="coordinator-walk-in-name" className={inputClass} value={vm.walkInName} onChange={(event) => vm.setWalkInName(event.target.value)} autoComplete="name" />
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={vm.privacyConsentAccepted}
              onChange={(event) => vm.setPrivacyConsentAccepted(event.target.checked)}
            />
            <span>The guest received the privacy notice and confirmed consent to event registration.</span>
          </label>
          <Button variant="outline" type="submit" className="h-10" disabled={vm.walkInBusy}>
            {vm.walkInBusy ? "Registering…" : "Register walk-in"}
          </Button>
        </form>

        {vm.error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{vm.error}</p> : null}
        {vm.notice ? <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground" role="status">{vm.notice}</p> : null}
      </div>
    </section>
  );
}

type RegistrationDeskViewModel = ReturnType<typeof useCoordinatorRegistrationDeskViewModel>;
function RegistrationRoster({ vm }: { vm: RegistrationDeskViewModel }) {
  if (vm.status !== "ready") return <p className="text-sm text-muted-foreground">{vm.pendingQueue ? "Loading pending reviews." : "Enter at least two letters, then search the roster."}</p>;
  if (!vm.entries.length) return (
    <Empty className="border-0 p-4">
      <EmptyHeader>
        <EmptyDescription>{vm.pendingQueue ? "No pending reviews." : "No guests match this search."}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
  return (
    <Table className="min-w-[760px] text-left">
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Table</TableHead>
          <TableHead>Eligibility</TableHead>
          <TableHead>Verification</TableHead>
          {vm.pendingQueue ? <TableHead>Submitted</TableHead> : null}
          <TableHead>Arrival</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{vm.entries.map((entry) => <RegistrationEntryRow key={entry.id} entry={entry} vm={vm} />)}</TableBody>
    </Table>
  );
}

function RegistrationEntryRow({ entry, vm }: { entry: PrismCoordinatorRegistrationEntry; vm: RegistrationDeskViewModel }) {
  const rowBusy = vm.busyEntryId === entry.id;
  const disabled = vm.busyEntryId !== null;
  return <TableRow>
    <TableCell className="font-semibold text-foreground">{entry.guestName}</TableCell>
    <TableCell className="text-muted-foreground">{entry.category || "—"}</TableCell>
    <TableCell className="text-muted-foreground">{entry.table || "—"}</TableCell>
    <TableCell className="text-muted-foreground">{entry.eligibility}</TableCell>
    <TableCell className="text-muted-foreground">{verificationLabel(entry)}</TableCell>
    <RegistrationSubmittedCell entry={entry} visible={vm.pendingQueue} />
    <TableCell className="text-muted-foreground">{checkedInLabel(entry)}</TableCell>
    <TableCell><RegistrationActions entry={entry} vm={vm} disabled={disabled} rowBusy={rowBusy} /></TableCell>
  </TableRow>;
}

function RegistrationSubmittedCell({ entry, visible }: { entry: PrismCoordinatorRegistrationEntry; visible: boolean }) {
  if (!visible) return null;
  return <TableCell className="text-muted-foreground">{entry.reviewSubmittedAt ? <time dateTime={entry.reviewSubmittedAt}>{submittedLabel(entry)}</time> : "—"}</TableCell>;
}

function busyLabel(rowBusy: boolean, label: string) {
  return rowBusy ? "Saving…" : label;
}

function RegistrationActions({ entry, vm, disabled, rowBusy }: { entry: PrismCoordinatorRegistrationEntry; vm: RegistrationDeskViewModel; disabled: boolean; rowBusy: boolean }) {
  return <div className="flex flex-wrap gap-2">
    {canVerifyRegistrationEntry(entry) ? <Button variant="outline" type="button" className="h-10" disabled={disabled} onClick={() => void vm.updateVerification(entry, "verified")} aria-label={`Mark ${entry.guestName} verified`}>{busyLabel(rowBusy, "Verify")}</Button> : null}
    {canRejectRegistrationEntry(entry) ? <Button variant="outline" type="button" className="h-10" disabled={disabled} onClick={() => void vm.updateVerification(entry, "rejected")} aria-label={`Reject ${entry.guestName}`}>Reject</Button> : null}
    {canFlagRegistrationEntry(entry) ? <Button variant="outline" type="button" className="h-10" disabled={disabled} onClick={() => void vm.flagForVerification(entry)} aria-label={`Flag ${entry.guestName} for verification`}>{busyLabel(rowBusy, "Flag for verification")}</Button> : null}
    {canCheckInRegistrationEntry(entry) ? <Button variant="outline" type="button" className="h-10" disabled={disabled} onClick={() => void vm.checkIn(entry)} aria-label={`Check in ${entry.guestName}`}>{busyLabel(rowBusy, "Check in")}</Button> : null}
  </div>;
}
