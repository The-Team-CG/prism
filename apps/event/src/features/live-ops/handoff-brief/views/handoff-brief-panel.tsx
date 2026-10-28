"use client";

import { useState, type ReactNode } from "react";
import { formatPortalDate, formatPortalDateTime, formatPortalTime } from "@prism/ui/format-date";
import type { PrismHandoffBrief } from "@prism/types";
import { useHandoffBriefViewModel } from "../view-models/use-handoff-brief-view-model";

type Brief = PrismHandoffBrief;

const words = (value: string) => value.replaceAll("_", " ");

function formatTime(iso: string) {
  return formatPortalTime(iso);
}

/**
 * The brief is reference material on the live desk, so PMCM sees a one-line summary
 * and expands it on demand. The coordinator brief view passes `defaultOpen`.
 */
export function HandoffBriefPanel({ eventId, defaultOpen = false }: { eventId: string; defaultOpen?: boolean }) {
  const vm = useHandoffBriefViewModel(eventId);
  const brief = vm.brief;
  const [open, setOpen] = useState(defaultOpen);
  const summary = vm.summary;

  return (
    <section aria-labelledby="handoff-brief-heading" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="handoff-brief-heading" className="text-lg font-semibold text-foreground">Handoff brief</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {summary
              ? `${summary.openIssueCount} open issues · ${summary.outstandingFileCount} files outstanding · ${summary.latestHandoffOutstandingCount} items from the latest handoff`
              : brief?.scope === "coordinator"
                ? "Your event-day subset."
                : "Planning-to-event-day snapshot."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="handoff-brief-body"
            onClick={() => setOpen((current) => !current)}
            className="min-h-11 rounded-md border border-border px-3 text-sm font-semibold"
          >
            {open ? "Hide brief" : "Show brief"}
          </button>
          <button type="button" onClick={() => void vm.reload()} className="min-h-11 rounded-md border border-border px-3 text-sm font-semibold" disabled={vm.loading}>
            Refresh brief
          </button>
        </div>
      </header>

      {vm.loading && !brief ? <p role="status" className="text-sm text-muted-foreground">Loading handoff brief…</p> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}

      <div id="handoff-brief-body" hidden={!open} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {brief?.scope === "coordinator"
            ? "Your event-day subset. Finance, private supplier notes and audit records are not shown."
            : "Built from the current scoped records."}
        </p>
        {brief ? <HandoffBriefBody brief={brief} /> : null}
      </div>
    </section>
  );
}

function HandoffBriefBody({ brief }: { brief: Brief }) {
  return (
    <>
      <KeyDetails details={brief.keyDetails} />
      <ScheduleSection days={brief.schedule.days} />
      <SupplierReadinessSection readiness={brief.supplierReadiness} />
      <StaffingSection staffing={brief.staffing} />
      <OpenIssuesSection issues={brief.openIssues} />
      <FilesSection files={brief.files} />
      <HandoffsSection handoffs={brief.handoffs} />
    </>
  );
}

function KeyDetails({ details }: { details: Brief["keyDetails"] }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Detail label="Event" value={details.eventName} />
      <Detail label="Date" value={formatPortalDate(details.eventDate)} />
      <Detail label="Status" value={words(details.status)} />
      <Detail label="Venue" value={details.venue ?? "Not recorded"} />
      <Detail label="Guests" value={details.guestCount === null ? "Not recorded" : String(details.guestCount)} />
      <Detail label="Walk-in policy" value={details.walkInPolicy ? words(details.walkInPolicy) : "Not set"} />
      {details.clientName ? <Detail label="Client" value={details.clientName} /> : null}
      {details.archived ? <Detail label="Archive" value="Archived, read-only" /> : null}
    </dl>
  );
}

function ScheduleSection({ days }: { days: Brief["schedule"]["days"] }) {
  const segments = days.flatMap((day) => day.segments.map((segment) => ({ day, segment })));

  return (
    <Section title="Schedule" empty="No schedule has been authored yet." count={segments.length}>
      {segments.map(({ day, segment }) => (
        <li key={segment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span className="font-semibold text-foreground">{segment.title}</span>
          <span className="text-muted-foreground">
            {day.dayDate} · {formatTime(segment.plannedStartAt)}–{formatTime(segment.plannedEndAt)} · {segment.ownerRole} · {words(segment.status)}
          </span>
        </li>
      ))}
    </Section>
  );
}

function SupplierReadinessSection({ readiness }: { readiness: Brief["supplierReadiness"] }) {
  return (
    <Section
      title="Supplier readiness"
      empty={readiness.visible ? "No suppliers are assigned to this event." : "Supplier readiness is not shared with this role."}
      count={readiness.items.length}
    >
      {readiness.items.map((supplier) => (
        <li key={supplier.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span className="font-semibold text-foreground">{supplier.supplierName} · {supplier.category}</span>
          <span className="text-muted-foreground">
            Readiness {words(supplier.readinessStatus)} · Event day {words(supplier.eventDayStatus)} · Verification {words(supplier.verificationStatus)}
          </span>
        </li>
      ))}
    </Section>
  );
}

function StaffingSection({ staffing }: { staffing: Brief["staffing"] }) {
  return (
    <Section title="Staffing" empty="No coordinator assignments visible to this role." count={staffing.length}>
      {staffing.map((assignment) => (
        <li key={assignment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span className="font-semibold text-foreground">{assignment.coordinatorName}</span>
          <span className="text-muted-foreground">{assignment.role} · {words(assignment.status)} · attendance {words(assignment.attendanceStatus)}</span>
        </li>
      ))}
    </Section>
  );
}

function OpenIssuesSection({ issues }: { issues: Brief["openIssues"] }) {
  return (
    <Section title="Open issues" empty="No open issues." count={issues.length}>
      {issues.map((issue) => (
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
  );
}

function FilesSection({ files }: { files: Brief["files"] }) {
  return (
    <Section title="Files" empty="No file requirements visible to this role." count={files.length}>
      {files.map((file) => (
        <li key={file.key} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span className="font-semibold text-foreground">{file.label}</span>
          <span className="text-muted-foreground">{words(file.status)}{file.dueDate ? ` · due ${formatPortalDate(file.dueDate)}` : ""}</span>
        </li>
      ))}
    </Section>
  );
}

function HandoffsSection({ handoffs }: { handoffs: Brief["handoffs"] }) {
  return (
    <Section title="Handoffs" empty="No shift handoffs recorded yet." count={handoffs.length}>
      {handoffs.map((handoff) => (
        <li key={handoff.id} className="space-y-1 py-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold text-foreground">{handoff.role}</span>
            <span className="text-muted-foreground">{formatPortalDateTime(handoff.handedOffAt)} · received by {handoff.receivedBy}</span>
          </div>
          {handoff.outstandingItems.length ? (
            <ul className="list-disc pl-5 text-muted-foreground">
              {handoff.outstandingItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="text-muted-foreground">No outstanding items.</p>}
        </li>
      ))}
    </Section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border pt-2">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border pt-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {count > 0 ? <ul className="divide-y divide-border">{children}</ul> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}
