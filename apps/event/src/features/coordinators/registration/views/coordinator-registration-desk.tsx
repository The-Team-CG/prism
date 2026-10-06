"use client";

import type { FormEvent } from "react";
import type { PrismCoordinatorRegistrationEntry } from "@prism/types";
import { canCheckInRegistrationEntry } from "../model/registration-rules";
import { useCoordinatorRegistrationDeskViewModel } from "../view-models/use-coordinator-registration-desk-view-model";

const buttonClass = "min-h-10 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

function checkedInLabel(entry: PrismCoordinatorRegistrationEntry): string {
  if (!entry.checkedInAt) return "Not checked in";
  const checkedInAt = new Date(entry.checkedInAt);
  return Number.isNaN(checkedInAt.getTime()) ? "Checked in" : `Checked in at ${checkedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function submittedLabel(entry: PrismCoordinatorRegistrationEntry): string {
  if (!entry.reviewSubmittedAt) return "—";
  const submittedAt = new Date(entry.reviewSubmittedAt);
  return Number.isNaN(submittedAt.getTime()) ? "—" : submittedAt.toLocaleString();
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
          <button className={`${buttonClass} sm:min-w-36`} type="submit" disabled={vm.status === "loading" || vm.query.trim().length < 2}>
            {vm.status === "loading" ? "Searching…" : "Search guests"}
          </button>
          <button className={buttonClass} type="button" onClick={() => void vm.loadPendingReviews()} disabled={vm.status === "loading"}>
            Pending reviews
          </button>
        </form>

        {vm.status === "ready" ? (
          vm.entries.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2.5">Guest</th>
                    <th scope="col" className="px-3 py-2.5">Category</th>
                    <th scope="col" className="px-3 py-2.5">Table</th>
                    <th scope="col" className="px-3 py-2.5">Eligibility</th>
                    <th scope="col" className="px-3 py-2.5">Verification</th>
                    {vm.pendingQueue ? <th scope="col" className="px-3 py-2.5">Submitted</th> : null}
                    <th scope="col" className="px-3 py-2.5">Arrival</th>
                    <th scope="col" className="px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vm.entries.map((entry) => {
                    const rowBusy = vm.busyEntryId === entry.id;
                    const disabled = vm.busyEntryId !== null;
                    return (
                      <tr key={entry.id}>
                        <th scope="row" className="px-3 py-3 font-semibold text-foreground">{entry.guestName}</th>
                        <td className="px-3 py-3 text-muted-foreground">{entry.category || "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground">{entry.table || "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground">{entry.eligibility}</td>
                        <td className="px-3 py-3 text-muted-foreground">{entry.verificationStatus}</td>
                        {vm.pendingQueue ? (
                          <td className="px-3 py-3 text-muted-foreground">
                            {entry.reviewSubmittedAt ? <time dateTime={entry.reviewSubmittedAt}>{submittedLabel(entry)}</time> : "—"}
                          </td>
                        ) : null}
                        <td className="px-3 py-3 text-muted-foreground">{checkedInLabel(entry)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {!entry.checkedInAt && entry.verificationStatus !== "verified" ? (
                              <button type="button" className={buttonClass} disabled={disabled} onClick={() => void vm.updateVerification(entry, "verified")} aria-label={`Mark ${entry.guestName} verified`}>
                                {rowBusy ? "Saving…" : "Verify"}
                              </button>
                            ) : null}
                            {!entry.checkedInAt && entry.verificationStatus !== "rejected" ? (
                              <button type="button" className={buttonClass} disabled={disabled} onClick={() => void vm.updateVerification(entry, "rejected")} aria-label={`Reject ${entry.guestName}`}>
                                Reject
                              </button>
                            ) : null}
                            {canCheckInRegistrationEntry(entry) ? (
                              <button type="button" className={buttonClass} disabled={disabled} onClick={() => void vm.checkIn(entry)} aria-label={`Check in ${entry.guestName}`}>
                                {rowBusy ? "Saving…" : "Check in"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{vm.pendingQueue ? "No pending reviews." : "No guests match this search."}</p>
        ) : <p className="text-sm text-muted-foreground">{vm.pendingQueue ? "Loading pending reviews." : "Enter at least two letters, then search the roster."}</p>}

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
          <button type="submit" className={buttonClass} disabled={vm.walkInBusy}>
            {vm.walkInBusy ? "Registering…" : "Register walk-in"}
          </button>
        </form>

        {vm.error ? <p className="rounded-md bg-(--prism-danger)/10 px-3 py-2 text-sm font-semibold text-(--prism-danger)" role="alert">{vm.error}</p> : null}
        {vm.notice ? <p className="rounded-md bg-(--prism-signal)/10 px-3 py-2 text-sm font-semibold text-foreground" role="status">{vm.notice}</p> : null}
      </div>
    </section>
  );
}
