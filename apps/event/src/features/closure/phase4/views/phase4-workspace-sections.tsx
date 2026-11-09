import { Button } from "@prism/ui/components/button";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";
import { Input } from "@prism/ui/components/input";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { AlertTriangle, Archive, BadgeCheck, CheckCircle2, Lightbulb, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

import type {

  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEvent,
  PrismEventInsight,
} from "@prism/types";
import { cx } from "@/features/pmcm-kit";
import {
  closeGateDestination,
  EVENT_DATE_CONDITION_KEY,
  eventDateRemediationLinks,
  isCompliancePhase,
  phase4ArchiveStatus,
  phase4StatusLabel,
  phase4StatusTone,
  type CloseGateDestination,
  type CompliancePhase,
} from "../model/phase4-workspace-rules";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export { money };

function Phase4Status({ value, label: text }: { value: string; label: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold", phase4StatusTone(value))}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function Phase4ClosureBoard({
  event,
  closeGates,
  cards,
}: {
  event: PrismEvent;
  closeGates: PrismCloseGates | null;
  cards: Array<{ label: string; value: string | number; detail: string; tone: string }>;
}) {
  const archive = phase4ArchiveStatus(event.archived, closeGates?.ready);
  return (
    <section className="rounded-lg border border-primary/15 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Close out this event</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Work through the steps below. The event can be archived once every close gate passes.
          </p>
        </div>
        <Phase4Status value={archive.toneKey} label={archive.label} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-secondary/35 px-3 py-2 sm:px-4 sm:py-3">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className={cx("mt-1 text-lg font-black", card.tone)}>{card.value}</p>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Phase4ComplianceSection({
  phase,
  checks,
  rules,
  openChecks,
  busy,
  onPhase,
  onRunCompliance,
  onResolveCompliance,
  onOverrideCompliance,
}: {
  phase: CompliancePhase;
  checks: PrismComplianceCheck[];
  rules: PrismComplianceRule[];
  openChecks: PrismComplianceCheck[];
  busy: boolean;
  onPhase: (value: CompliancePhase) => void;
  onRunCompliance: () => void;
  onResolveCompliance: (checkId: string) => void;
  onOverrideCompliance: (checkId: string, reason: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 size-5 text-attention" />
          <div>
            <h3 className="text-xl font-black">Compliance checks</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="phase4-run-phase" className="text-sm text-muted-foreground">Phase</label>
          <select id="phase4-run-phase" value={phase} onChange={(event) => { if (isCompliancePhase(event.target.value)) onPhase(event.target.value); }} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            <option value="planning">Planning</option>
            <option value="pre_event">Pre-event</option>
            <option value="event_day">Event day</option>
            <option value="closure">Closure</option>
          </select>
          <button disabled={busy} onClick={onRunCompliance} className="h-10 rounded-md bg-ink px-3 text-sm font-black text-ink-foreground disabled:opacity-60">
            Run checks
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {checks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
            No compliance checks generated yet. Pick the phase and run checks for the event record.
          </div>
        ) : (
          <>
            {/* Open checks need a decision, grouped by phase; settled ones stay one click away. */}
            {groupChecksByPhase(checks.filter((check) => check.status === "open")).map((group) => (
              <section key={group.phase} aria-label={`${group.label} checks`} className="overflow-hidden rounded-md border border-border bg-background">
                <h4 className="flex items-baseline gap-2 border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground">
                  {group.label}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{group.checks.length} open</span>
                </h4>
                <ul className="divide-y divide-border">
                  {group.checks.map((check) => (
                    <Phase4ComplianceCheckRow key={check.id} check={check} busy={busy} onResolve={onResolveCompliance} onOverride={onOverrideCompliance} onRunCompliance={onRunCompliance} />
                  ))}
                </ul>
              </section>
            ))}
            {checks.some((check) => check.status !== "open") ? (
              <details className="overflow-hidden rounded-md border border-border bg-background">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                  {checks.filter((check) => check.status !== "open").length} resolved or overridden
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {checks.filter((check) => check.status !== "open").map((check) => (
                    <Phase4ComplianceCheckRow key={check.id} check={check} busy={busy} onResolve={onResolveCompliance} onOverride={onOverrideCompliance} onRunCompliance={onRunCompliance} />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}

        <p className="text-sm text-muted-foreground">
          {rules.filter((rule) => rule.active).length} active rule(s) apply.{" "}
          <a href="/dashboard/settings#compliance-rules" className="font-semibold text-primary hover:text-primary-strong">Manage workspace rules in Settings</a>
        </p>
      </div>
    </section>
  );
}

const PHASE_LABELS: Record<string, string> = { planning: "Planning", pre_event: "Pre-event", event_day: "Event day", closure: "Closure" };
const PHASE_ORDER = ["planning", "pre_event", "event_day", "closure"];

/** Checks for the same rule can exist once per phase; grouping by phase shows why a title repeats. */
function groupChecksByPhase(checks: PrismComplianceCheck[]) {
  const groups = new Map<string, PrismComplianceCheck[]>();
  for (const check of checks) {
    const phase = check.phase || "other";
    groups.set(phase, [...(groups.get(phase) ?? []), check]);
  }
  const rank = (phase: string) => (PHASE_ORDER.includes(phase) ? PHASE_ORDER.indexOf(phase) : PHASE_ORDER.length);
  return [...groups.entries()]
    .sort(([left], [right]) => rank(left) - rank(right))
    .map(([phase, items]) => ({ phase, label: PHASE_LABELS[phase] ?? "Other checks", checks: items }));
}

function Phase4ComplianceCheckRow({
  check,
  busy,
  onResolve,
  onOverride,
  onRunCompliance,
}: {
  check: PrismComplianceCheck;
  busy: boolean;
  onRunCompliance: () => void;
  onResolve: (checkId: string) => void;
  onOverride: (checkId: string, reason: string) => void;
}) {
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {check.title}
            <Phase4Status value={check.status} label={phase4StatusLabel(check.status)} />
          </p>
          {check.note ? <p className="truncate text-xs text-muted-foreground" title={check.note}>{check.note}</p> : null}
          {check.status === "open" && check.conditionKey === EVENT_DATE_CONDITION_KEY ? (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              {eventDateRemediationLinks(check.eventId).map((link) => (
                <a key={link.label} href={link.href} className="text-primary hover:text-primary-strong">{link.label}</a>
              ))}
            </p>
          ) : null}
        </div>
        {check.status === "open" ? (
          <div className="flex shrink-0 gap-1.5">
            <button disabled={busy} onClick={() => onResolve(check.id)} className="h-7 rounded-md bg-success-soft px-2.5 text-xs font-semibold text-success disabled:opacity-60">Resolve</button>
            <button disabled={busy} onClick={() => onOverride(check.id, "PMCM accepted documented operational risk.")} className="h-7 rounded-md bg-attention-soft px-2.5 text-xs font-semibold text-attention disabled:opacity-60">Override</button>
          </div>
        ) : null}
      </div>
      <details className="group mt-1">
        <summary className="w-fit cursor-pointer list-none text-xs font-medium text-primary hover:text-primary-strong">
          <span className="group-open:hidden">Details</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          {check.overrideReason ? <p className="rounded-md bg-attention-soft px-3 py-2 text-attention">Override: {check.overrideReason}</p> : null}
          {check.evidence.length > 0 ? (
            <ul aria-label="Evidence" className="list-disc pl-5">{check.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <p>No evidence recorded for this check yet. Run checks again to collect it{check.status === "open" ? ", or resolve it with a note" : ""}.</p>
              <button type="button" disabled={busy} onClick={onRunCompliance} className="h-7 rounded-md border border-border bg-background px-2.5 font-semibold text-foreground disabled:opacity-60">Collect evidence</button>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

/** datetime-local holds wall-clock time; submit reads it back as local, so prefill in local time too. */
function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ActualEventEndSection({ event, busy, onRecord }: { event: PrismEvent; busy: boolean; onRecord: (input: { actualEndedAt: string; correctionReason?: string }) => Promise<void> }) {
  const [endedAt, setEndedAt] = useState(event.actualEndedAt ? toLocalDateTimeInput(event.actualEndedAt) : "");
  const [reason, setReason] = useState("");
  const hasRecorded = Boolean(event.actualEndedAt);
  async function submit() {
    if (!endedAt || (hasRecorded && !reason.trim())) return;
    await onRecord({ actualEndedAt: new Date(endedAt).toISOString(), ...(reason.trim() ? { correctionReason: reason.trim() } : {}) });
    setReason("");
  }
  return <section className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">Record actual end</h3><span className="text-xs text-muted-foreground">{event.actualEndedAt ? formatPortalDateTime(event.actualEndedAt) : "Not recorded"}</span></div>
    <p className="mt-2 text-sm text-muted-foreground">This timestamp opens the seven-day guest feedback window and supports final registration imports.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-semibold">Actual ended at<DateTimePicker value={endedAt} onValueChange={(next) => setEndedAt(next)} className="w-64" /></label>
      {hasRecorded ? (
        <label className="grid gap-1 text-sm font-semibold">Correction reason<Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the end changing?" className="w-64 font-normal" /></label>
      ) : null}
      <Button disabled={busy || !endedAt || (hasRecorded && !reason.trim())} onClick={() => void submit()}>
        {hasRecorded ? "Correct actual end" : "Record actual end"}
      </Button>
    </div>
  </section>;
}

export function Phase4CloseGatesSection({
  closeGates,
  overrideReason,
  busy,
  onOverrideReason,
  onRefresh,
  onArchive,
  onOpenDestination,
}: {
  closeGates: PrismCloseGates | null;
  overrideReason: string;
  busy: boolean;
  onOverrideReason: (value: string) => void;
  onRefresh: () => void;
  onArchive: () => void;
  onOpenDestination: (destination: CloseGateDestination) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Archive className="mt-1 size-5 text-attention" />
          <div>
            <h3 className="text-lg font-semibold">Close gates</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Every gate must pass, or be overridden with a reason, before archiving.</p>
          </div>
        </div>
        <button disabled={busy} onClick={onRefresh} className="h-9 rounded-md border border-border bg-white px-3 text-xs font-black disabled:opacity-60">Refresh</button>
      </div>
      <div className="mt-4 space-y-2">
        {closeGates?.gates.map((gate) => {
          const destination = closeGateDestination(gate.key);
          return (
            <div key={gate.key} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex min-w-0 items-start gap-3">
                {gate.passed ? <BadgeCheck className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-danger" />}
                <div>
                  <p className="font-black">{gate.label}</p>
                  <p className="mt-1 text-muted-foreground">{gate.detail}</p>
                </div>
              </div>
              {!gate.passed && destination ? (
                <button type="button" onClick={() => onOpenDestination(destination)} className="h-8 shrink-0 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground">
                  {destination.label}
                </button>
              ) : null}
            </div>
          );
        })}
        {!closeGates && (
          <div className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
            Loading close-gate status for this selected event.
          </div>
        )}
        {closeGates?.ready && (
          <div className="flex items-start gap-3 rounded-md border border-success/25 bg-success-soft p-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4" />
            <div>
              <p className="font-black">All close gates passed</p>
              <p className="mt-1">Archive can proceed without an override reason.</p>
            </div>
          </div>
        )}
      </div>
      {!closeGates?.ready && (
        <div className="mt-4">
          <div className="mb-2 flex items-start gap-2 text-xs leading-5 text-attention">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Override is only for PMCM-approved operational risk.</span>
          </div>
          <textarea value={overrideReason} onChange={(event) => onOverrideReason(event.target.value)} placeholder="Required PMCM override reason if gates are not complete" className="min-h-20 w-full rounded-md border border-border bg-white p-3 text-sm" />
        </div>
      )}
      <button disabled={busy || (!closeGates?.ready && !overrideReason)} onClick={onArchive} className="mt-4 h-10 w-full rounded-md bg-ink px-3 text-sm font-black text-ink-foreground disabled:opacity-60">
        Archive event
      </button>
    </div>
  );
}

export function Phase4InsightsSection({
  latestInsight,
  busy,
  onGenerate,
}: {
  latestInsight?: PrismEventInsight;
  busy: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-1 size-5 text-attention" />
          <div>
            <h3 className="text-lg font-semibold">Post-event insights</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">A summary of what happened, kept for planning future events.</p>
          </div>
        </div>
        <button disabled={busy} onClick={onGenerate} className="h-10 rounded-md bg-ink px-3 text-sm font-black text-ink-foreground disabled:opacity-60">
          Generate insights
        </button>
      </div>
      {latestInsight ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-md border border-border bg-background p-4">
            <p className="font-black">{latestInsight.summary}</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {latestInsight.highlights.map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-background p-4 text-sm">
            <p className="font-black">Financial snapshot</p>
            <p className="mt-2 text-muted-foreground">Billed: {money.format(latestInsight.financialSummary.totalBilled ?? 0)}</p>
            <p className="text-muted-foreground">Outstanding: {money.format(latestInsight.financialSummary.outstandingAmount ?? 0)}</p>
            <p className="mt-3 text-xs text-muted-foreground">PMCM-only notes. These never appear on client, supplier, or guest portals.</p>
            <p className="mt-3 text-xs text-muted-foreground">{latestInsight.privateNotes}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-4 text-sm lg:col-span-2">
            <p className="font-black">Coordinator staffing</p>
            {latestInsight.dimensions?.coordinators ? (
              <>
                <p className="mt-2 text-muted-foreground">{latestInsight.dimensions.coordinators.summary}</p>
                {latestInsight.dimensions.coordinators.evidence.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidence: {latestInsight.dimensions.coordinators.evidence.join(" · ")}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-muted-foreground">
                This insight predates coordinator staffing data. Generate a new insight to include assignment and reliability history.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          Generate the first insights summary after close data is ready.
        </div>
      )}
    </section>
  );
}
