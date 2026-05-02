import { useEffect, useMemo, useState } from "react";
import { Archive, BadgeCheck, Lightbulb, Plus, ReceiptText, ShieldCheck, XCircle } from "lucide-react";

import {
  type MvpBillingSource,
  type MvpBillingStatement,
  type MvpCloseGates,
  type MvpComplianceCheck,
  type MvpComplianceRule,
  type MvpEvent,
  type MvpEventInsight,
} from "@/lib/mvp-api";
import { cx, label } from "./helpers";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function statusTone(value: string, passed?: boolean) {
  if (passed || ["approved", "resolved", "overridden", "generated", "sent"].includes(value)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (["draft", "issued", "open"].includes(value)) return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-rose-50 text-rose-700 ring-rose-100";
}

export function Phase4Workspace({
  event,
  rules,
  checks,
  billingSources,
  billingStatements,
  insights,
  busy,
  onCreateRule,
  onRunCompliance,
  onResolveCompliance,
  onOverrideCompliance,
  onCreateBillingSource,
  onApproveBillingSource,
  onGenerateBillingStatement,
  onLoadCloseGates,
  onArchive,
  onLoadInsights,
  onGenerateInsights,
}: {
  event: MvpEvent;
  rules: MvpComplianceRule[];
  checks: MvpComplianceCheck[];
  billingSources: MvpBillingSource[];
  billingStatements: MvpBillingStatement[];
  insights: MvpEventInsight[];
  busy: boolean;
  onCreateRule: (input: {
    title: string;
    conditionKey: string;
    phase: string;
    severity: string;
    layer: string;
    note: string;
  }) => Promise<void>;
  onRunCompliance: (phase: string) => Promise<void>;
  onResolveCompliance: (checkId: string) => Promise<void>;
  onOverrideCompliance: (checkId: string, reason: string) => Promise<void>;
  onCreateBillingSource: (input: {
    sourceLabel: string;
    lineItems: Array<{ label: string; amount: number }>;
    paymentSchedule: Array<{ label: string; percentage: number }>;
  }) => Promise<void>;
  onApproveBillingSource: (sourceId: string) => Promise<void>;
  onGenerateBillingStatement: (sourceId: string) => Promise<void>;
  onLoadCloseGates: () => Promise<MvpCloseGates>;
  onArchive: (overrideReason?: string) => Promise<void>;
  onLoadInsights: () => Promise<MvpEventInsight[]>;
  onGenerateInsights: () => Promise<void>;
}) {
  const [phase, setPhase] = useState("planning");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleKey, setRuleKey] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState("must_fix");
  const [ruleNote, setRuleNote] = useState("");
  const [billingLabel, setBillingLabel] = useState(`${event.eventName} approved CE`);
  const [lineLabel, setLineLabel] = useState("Approved event package");
  const [lineAmount, setLineAmount] = useState("520000");
  const [closeGates, setCloseGates] = useState<MvpCloseGates | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [localInsights, setLocalInsights] = useState<MvpEventInsight[]>(insights);

  useEffect(() => {
    setBillingLabel(`${event.eventName} approved CE`);
    void onLoadCloseGates().then(setCloseGates).catch(() => setCloseGates(null));
    void onLoadInsights().then(setLocalInsights).catch(() => setLocalInsights(insights));
  }, [event.id]);

  useEffect(() => {
    setLocalInsights(insights);
  }, [insights]);

  const approvedSource = billingSources.find((source) => source.status === "approved");
  const latestInsight = localInsights[0];
  const openChecks = checks.filter((check) => check.status === "open");

  async function createRule() {
    await onCreateRule({
      title: ruleTitle,
      conditionKey: ruleKey,
      phase,
      severity: ruleSeverity,
      layer: ruleSeverity === "watch_out" ? "Should-Fix" : "Must-Fix",
      note: ruleNote,
    });
    setRuleTitle("");
    setRuleKey("");
    setRuleNote("");
  }

  async function createBillingSource() {
    await onCreateBillingSource({
      sourceLabel: billingLabel,
      lineItems: [{ label: lineLabel, amount: Number(lineAmount) }],
      paymentSchedule: [
        { label: "Downpayment", percentage: 50 },
        { label: "Balance", percentage: 50 },
      ],
    });
  }

  async function refreshCloseGates() {
    setCloseGates(await onLoadCloseGates());
  }

  async function archiveEvent() {
    await onArchive(closeGates?.ready ? undefined : overrideReason);
    await refreshCloseGates();
  }

  async function generateInsights() {
    await onGenerateInsights();
    setLocalInsights(await onLoadInsights());
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 text-(--prism-amber)" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Compliance</p>
              <h3 className="mt-1 text-xl font-black">Rule-backed checks</h3>
            </div>
          </div>
          <button disabled={busy} onClick={() => onRunCompliance(phase)} className="h-10 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
            Run checks
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm font-black">Add PMCM rule</p>
            <div className="mt-3 grid gap-3">
              <input value={ruleTitle} onChange={(event) => setRuleTitle(event.target.value)} placeholder="Rule title" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
              <input value={ruleKey} onChange={(event) => setRuleKey(event.target.value)} placeholder="condition_key" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={phase} onChange={(event) => setPhase(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                  <option value="planning">Planning</option>
                  <option value="pre_event">Pre-event</option>
                  <option value="event_day">Event day</option>
                </select>
                <select value={ruleSeverity} onChange={(event) => setRuleSeverity(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                  <option value="must_fix">Must-Fix</option>
                  <option value="watch_out">Watch Out</option>
                  <option value="advisory">Advisory</option>
                </select>
              </div>
              <textarea value={ruleNote} onChange={(event) => setRuleNote(event.target.value)} placeholder="PMCM note" className="min-h-20 rounded-md border border-border bg-white p-3 text-sm" />
              <button disabled={busy || !ruleTitle || !ruleKey} onClick={createRule} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary/20 bg-white px-3 text-sm font-black text-foreground disabled:opacity-60">
                <Plus className="size-4" /> Add rule
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {checks.length === 0 && <div className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">No compliance checks generated yet.</div>}
            {checks.map((check) => (
              <div key={check.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{check.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{check.note}</p>
                  </div>
                  <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", statusTone(check.status))}>{label(check.status)}</span>
                </div>
                {check.overrideReason && <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">Override: {check.overrideReason}</p>}
                {check.status === "open" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => onResolveCompliance(check.id)} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">Resolve</button>
                    <button disabled={busy} onClick={() => onOverrideCompliance(check.id, "PMCM accepted documented operational risk.")} className="h-8 rounded-md bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-60">Override</button>
                  </div>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{rules.filter((rule) => rule.active).length} active rule(s), {openChecks.length} open check(s).</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ReceiptText className="mt-1 size-5 text-(--prism-amber)" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Billing Source</p>
              <h3 className="mt-1 text-xl font-black">Approved CE/proposal total</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <input value={billingLabel} onChange={(event) => setBillingLabel(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <input value={lineLabel} onChange={(event) => setLineLabel(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
              <input value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} type="number" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
            </div>
            <button disabled={busy || !billingLabel || Number(lineAmount) <= 0} onClick={createBillingSource} className="h-10 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">Create billing source</button>
          </div>
          <div className="mt-4 space-y-3">
            {billingSources.map((source) => (
              <div key={source.id} className="rounded-md border border-border bg-background p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{source.sourceLabel}</p>
                    <p className="mt-1 text-muted-foreground">{money.format(source.totalAmount)} - {source.lineItems.length} line item(s)</p>
                  </div>
                  <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", statusTone(source.status))}>{label(source.status)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {source.status !== "approved" && <button disabled={busy} onClick={() => onApproveBillingSource(source.id)} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">Approve</button>}
                  {source.status === "approved" && <button disabled={busy} onClick={() => onGenerateBillingStatement(source.id)} className="h-8 rounded-md border border-border bg-white px-3 text-xs font-black disabled:opacity-60">Generate billing</button>}
                </div>
              </div>
            ))}
            {billingStatements.length > 0 && <p className="text-xs text-muted-foreground">{billingStatements.length} billing statement(s) generated from approved source data.</p>}
            {!approvedSource && billingSources.length > 0 && <p className="text-xs text-amber-800">Approve a source before generating a billing statement.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Archive className="mt-1 size-5 text-(--prism-amber)" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Close Gates</p>
                <h3 className="mt-1 text-xl font-black">One-screen close</h3>
              </div>
            </div>
            <button disabled={busy} onClick={refreshCloseGates} className="h-9 rounded-md border border-border bg-white px-3 text-xs font-black disabled:opacity-60">Refresh</button>
          </div>
          <div className="mt-4 space-y-2">
            {closeGates?.gates.map((gate) => (
              <div key={gate.key} className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm">
                {gate.passed ? <BadgeCheck className="mt-0.5 size-4 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 text-rose-600" />}
                <div>
                  <p className="font-black">{gate.label}</p>
                  <p className="mt-1 text-muted-foreground">{gate.detail}</p>
                </div>
              </div>
            ))}
            {!closeGates && <p className="text-sm text-muted-foreground">Close-gate status has not loaded yet.</p>}
          </div>
          {!closeGates?.ready && (
            <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required PMCM override reason if gates are not complete" className="mt-4 min-h-20 w-full rounded-md border border-border bg-white p-3 text-sm" />
          )}
          <button disabled={busy || (!closeGates?.ready && !overrideReason)} onClick={archiveEvent} className="mt-4 h-10 w-full rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
            Archive event
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 size-5 text-(--prism-amber)" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Event Insights</p>
              <h3 className="mt-1 text-xl font-black">Deterministic PMCM knowledge capture</h3>
            </div>
          </div>
          <button disabled={busy} onClick={generateInsights} className="h-10 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
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
              <p className="mt-3 text-xs text-muted-foreground">{latestInsight.privateNotes}</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            Generate the first Event Insights Card after close data is ready.
          </div>
        )}
      </section>
    </div>
  );
}
