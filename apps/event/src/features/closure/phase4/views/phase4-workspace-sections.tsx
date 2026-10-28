import { formatPortalDateTime } from "@prism/ui/format-date";
import { AlertTriangle, Archive, BadgeCheck, CheckCircle2, Lightbulb, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

import type {

  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEvent,
  PrismEventInsight,
} from "@prism/types";
import { cx, label } from "@/features/pmcm-kit";
import { phase4ArchiveStatus, phase4StatusTone } from "../model/phase4-workspace-rules";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export { money };

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
          <p className="text-xs font-medium text-attention">Closure board</p>
          <h3 className="mt-1 text-xl font-black text-foreground">{event.eventName}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Archive readiness is local to PMCM: compliance checks, approved billing source, generated statements, and post-event insights stay visible before close.
          </p>
        </div>
        <span className={cx("rounded-full px-3 py-1 text-xs font-black capitalize ring-1", phase4StatusTone(archive.toneKey))}>
          {archive.label}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-secondary/35 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className={cx("mt-1 text-lg font-black", card.tone)}>{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Phase4ComplianceSection({
  phase,
  ruleTitle,
  ruleKey,
  ruleSeverity,
  ruleNote,
  checks,
  rules,
  openChecks,
  busy,
  onPhase,
  onRuleTitle,
  onRuleKey,
  onRuleSeverity,
  onRuleNote,
  onCreateRule,
  onRunCompliance,
  onResolveCompliance,
  onOverrideCompliance,
}: {
  phase: string;
  ruleTitle: string;
  ruleKey: string;
  ruleSeverity: string;
  ruleNote: string;
  checks: PrismComplianceCheck[];
  rules: PrismComplianceRule[];
  openChecks: PrismComplianceCheck[];
  busy: boolean;
  onPhase: (value: string) => void;
  onRuleTitle: (value: string) => void;
  onRuleKey: (value: string) => void;
  onRuleSeverity: (value: string) => void;
  onRuleNote: (value: string) => void;
  onCreateRule: () => void;
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
        <button disabled={busy} onClick={onRunCompliance} className="h-10 rounded-md bg-ink px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
          Run checks
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm font-black">Add PMCM rule</p>
          <div className="mt-3 grid gap-3">
            <label htmlFor="phase4-rule-title" className="sr-only">Rule title</label>
            <input id="phase4-rule-title" value={ruleTitle} onChange={(event) => onRuleTitle(event.target.value)} placeholder="Rule title" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
            <label htmlFor="phase4-rule-key" className="sr-only">Condition key</label>
            <input id="phase4-rule-key" value={ruleKey} onChange={(event) => onRuleKey(event.target.value)} placeholder="condition_key" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select aria-label="Rule phase" value={phase} onChange={(event) => onPhase(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                <option value="planning">Planning</option>
                <option value="pre_event">Pre-event</option>
                <option value="event_day">Event day</option>
              </select>
              <select aria-label="Rule severity" value={ruleSeverity} onChange={(event) => onRuleSeverity(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                <option value="must_fix">Must-Fix</option>
                <option value="watch_out">Watch Out</option>
                <option value="advisory">Advisory</option>
              </select>
            </div>
            <label htmlFor="phase4-rule-note" className="sr-only">PMCM note</label>
            <textarea id="phase4-rule-note" value={ruleNote} onChange={(event) => onRuleNote(event.target.value)} placeholder="PMCM note" className="min-h-20 rounded-md border border-border bg-white p-3 text-sm" />
            <button disabled={busy || !ruleTitle || !ruleKey} onClick={onCreateRule} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary/20 bg-white px-3 text-sm font-black text-foreground disabled:opacity-60">
              <Plus className="size-4" /> Add rule
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {checks.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
              No compliance checks generated yet. Pick the phase and run checks for the event record.
            </div>
          )}
          {checks.map((check) => (
            <Phase4ComplianceCheckCard
              key={check.id}
              check={check}
              busy={busy}
              onResolve={onResolveCompliance}
              onOverride={onOverrideCompliance}
              onRunCompliance={onRunCompliance}
            />
          ))}
          <p className="text-xs text-muted-foreground">{rules.filter((rule) => rule.active).length} active rule(s), {openChecks.length} open check(s).</p>
        </div>
      </div>
    </section>
  );
}

function Phase4ComplianceCheckCard({
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
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{check.title}</p>
          {check.note ? <p className="mt-1 text-sm text-muted-foreground">{check.note}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">Evaluation: {check.evaluationStatus} · {check.definitionStatus}</p>
        </div>
        <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", phase4StatusTone(check.status))}>{label(check.status)}</span>
      </div>
      {check.overrideReason && <p className="mt-3 rounded-md bg-attention-soft p-3 text-xs text-attention">Override: {check.overrideReason}</p>}
      {check.evidence.length > 0 ? (
        <ul aria-label="Evidence" className="mt-3 list-disc pl-5 text-xs text-muted-foreground">{check.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">No evidence recorded for this check yet. Run checks again to collect it{check.status === "open" ? ", or resolve it with a note" : ""}.</p>
          <button type="button" disabled={busy} onClick={onRunCompliance} className="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:opacity-60">Collect evidence</button>
        </div>
      )}
      {check.status === "open" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => onResolve(check.id)} className="h-8 rounded-md bg-success-soft px-3 text-xs font-black text-success disabled:opacity-60">Resolve</button>
          <button disabled={busy} onClick={() => onOverride(check.id, "PMCM accepted documented operational risk.")} className="h-8 rounded-md bg-attention-soft px-3 text-xs font-black text-attention disabled:opacity-60">Override</button>
        </div>
      )}
    </div>
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
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-attention">Event end</p><h3 className="mt-1 text-xl font-black">Record actual end</h3></div><span className="text-xs text-muted-foreground">{event.actualEndedAt ? formatPortalDateTime(event.actualEndedAt) : "Not recorded"}</span></div>
    <p className="mt-2 text-sm text-muted-foreground">This timestamp opens the seven-day guest feedback window and supports final registration imports.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Actual ended at<input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="mt-1 block h-10 rounded-md border border-border bg-white px-3" /></label>{hasRecorded && <label className="text-sm font-semibold">Correction reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the end changing?" className="mt-1 block h-10 rounded-md border border-border bg-white px-3" /></label>}<button disabled={busy || !endedAt || (hasRecorded && !reason.trim())} onClick={() => void submit()} className="h-10 rounded-md bg-ink px-4 text-sm font-black text-sidebar-foreground disabled:opacity-60">{hasRecorded ? "Correct actual end" : "Record actual end"}</button></div>
  </section>;
}

export function Phase4CloseGatesSection({
  closeGates,
  overrideReason,
  busy,
  onOverrideReason,
  onRefresh,
  onArchive,
}: {
  closeGates: PrismCloseGates | null;
  overrideReason: string;
  busy: boolean;
  onOverrideReason: (value: string) => void;
  onRefresh: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Archive className="mt-1 size-5 text-attention" />
          <div>
            <p className="text-xs font-medium text-attention">Close Gates</p>
            <h3 className="mt-1 text-xl font-black">One-screen close</h3>
          </div>
        </div>
        <button disabled={busy} onClick={onRefresh} className="h-9 rounded-md border border-border bg-white px-3 text-xs font-black disabled:opacity-60">Refresh</button>
      </div>
      <div className="mt-4 space-y-2">
        {closeGates?.gates.map((gate) => (
          <div key={gate.key} className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm">
            {gate.passed ? <BadgeCheck className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-danger" />}
            <div>
              <p className="font-black">{gate.label}</p>
              <p className="mt-1 text-muted-foreground">{gate.detail}</p>
            </div>
          </div>
        ))}
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
      <button disabled={busy || (!closeGates?.ready && !overrideReason)} onClick={onArchive} className="mt-4 h-10 w-full rounded-md bg-ink px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
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
            <p className="text-xs font-medium text-attention">Event Insights</p>
            <h3 className="mt-1 text-xl font-black">Deterministic PMCM knowledge capture</h3>
          </div>
        </div>
        <button disabled={busy} onClick={onGenerate} className="h-10 rounded-md bg-ink px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
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
          Generate the first Event Insights Card after close data is ready.
        </div>
      )}
    </section>
  );
}
