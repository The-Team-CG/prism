"use client";

import type { ReactNode } from "react";
import { useHandoffBriefViewModel } from "../view-models/use-handoff-brief-view-model";

const words = (value: string) => value.replaceAll("_", " ");

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HandoffBriefPanel({ eventId }: { eventId: string }) {
  const vm = useHandoffBriefViewModel(eventId);
  const brief = vm.brief;
  const scheduleSegments = brief?.schedule.days.flatMap((day) => day.segments.map((segment) => ({ day, segment }))) ?? [];

  return (
    <section aria-labelledby="handoff-brief-heading" className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="handoff-brief-heading" className="text-lg font-bold text-foreground">Handoff brief</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {brief?.scope === "coordinator"
              ? "Your event-day subset. Finance, private supplier notes and audit records are not shown."
              : "Planning-to-event-day snapshot for PMCM. Built from the current scoped records."}
          </p>
        </div>
        <button type="button" onClick={() => void vm.reload()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold" disabled={vm.loading}>
          Refresh brief
        </button>
      </header>

      {vm.loading && !brief ? <p role="status" className="text-sm text-muted-foreground">Loading handoff brief…</p> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}

      {brief ? (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Event" value={brief.keyDetails.eventName} />
            <Detail label="Date" value={brief.keyDetails.eventDate} />
            <Detail label="Status" value={words(brief.keyDetails.status)} />
            <Detail label="Venue" value={brief.keyDetails.venue ?? "Not recorded"} />
            <Detail label="Guests" value={brief.keyDetails.guestCount === null ? "Not recorded" : String(brief.keyDetails.guestCount)} />
            <Detail label="Walk-in policy" value={brief.keyDetails.walkInPolicy ? words(brief.keyDetails.walkInPolicy) : "Not set"} />
            {brief.keyDetails.clientName ? <Detail label="Client" value={brief.keyDetails.clientName} /> : null}
            {brief.keyDetails.archived ? <Detail label="Archive" value="Archived, read-only" /> : null}
          </dl>

          <Section title="Schedule" empty="No schedule has been authored yet." count={scheduleSegments.length}>
            {scheduleSegments.map(({ day, segment }) => (
              <li key={segment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-foreground">{segment.title}</span>
                <span className="text-muted-foreground">
                  {day.dayDate} · {formatTime(segment.plannedStartAt)}–{formatTime(segment.plannedEndAt)} · {segment.ownerRole} · {words(segment.status)}
                </span>
              </li>
            ))}
          </Section>

          <Section
            title="Supplier readiness"
            empty={brief.supplierReadiness.visible ? "No suppliers are assigned to this event." : "Supplier readiness is not shared with this role."}
            count={brief.supplierReadiness.items.length}
          >
            {brief.supplierReadiness.items.map((supplier) => (
              <li key={supplier.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-foreground">{supplier.supplierName} · {supplier.category}</span>
                <span className="text-muted-foreground">
                  Readiness {words(supplier.readinessStatus)} · Event day {words(supplier.eventDayStatus)} · Verification {words(supplier.verificationStatus)}
                </span>
              </li>
            ))}
          </Section>

          <Section title="Staffing" empty="No coordinator assignments visible to this role." count={brief.staffing.length}>
            {brief.staffing.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-foreground">{assignment.coordinatorName}</span>
                <span className="text-muted-foreground">{assignment.role} · {words(assignment.status)} · attendance {words(assignment.attendanceStatus)}</span>
              </li>
            ))}
          </Section>

          <Section title="Open issues" empty="No open issues." count={brief.openIssues.length}>
            {brief.openIssues.map((issue) => (
              <li key={issue.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-foreground">{issue.title}</span>
                  <span className="text-muted-foreground">{words(issue.severity)} · {words(issue.status)} · SLA {words(issue.slaStatus)}</span>
                </div>
                <p className="text-muted-foreground">
                  {issue.affectedArea ? `${issue.affectedArea} · ` : ""}Owner {issue.ownerName || issue.ownerRole || "unassigned"}
                </p>
              </li>
            ))}
          </Section>

          <Section title="Files" empty="No file requirements visible to this role." count={brief.files.length}>
            {brief.files.map((file) => (
              <li key={file.key} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-foreground">{file.label}</span>
                <span className="text-muted-foreground">{words(file.status)}{file.dueDate ? ` · due ${file.dueDate}` : ""}</span>
              </li>
            ))}
          </Section>

          <Section title="Handoffs" empty="No shift handoffs recorded yet." count={brief.handoffs.length}>
            {brief.handoffs.map((handoff) => (
              <li key={handoff.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-foreground">{handoff.role}</span>
                  <span className="text-muted-foreground">{new Date(handoff.handedOffAt).toLocaleString()} · received by {handoff.receivedBy}</span>
                </div>
                {handoff.outstandingItems.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {handoff.outstandingItems.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p className="text-muted-foreground">No outstanding items.</p>}
              </li>
            ))}
          </Section>
        </>
      ) : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border pt-4">
      <h3 className="font-bold text-foreground">{title}</h3>
      {count > 0 ? <ul className="divide-y divide-border">{children}</ul> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}
