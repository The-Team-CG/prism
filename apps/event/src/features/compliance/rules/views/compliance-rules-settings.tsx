"use client";

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import type { PrismComplianceRule } from "@prism/types";
import {
  COMPLIANCE_RULE_PHASES,
  COMPLIANCE_RULE_SEVERITIES,
  EMPTY_COMPLIANCE_RULE_DRAFT,
  activeWorkspaceRules,
  complianceOptionLabel,
  toCreateComplianceRuleInput,
  type ComplianceRuleDraft,
} from "../model/compliance-rule-rules";

const FIELD = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";

/** Settings → Compliance rules: rules here apply to every event's compliance checks. */
export function ComplianceRulesSettings({
  rules,
  busy,
  onCreateRule,
}: {
  rules: PrismComplianceRule[];
  busy: boolean;
  onCreateRule: (input: ReturnType<typeof toCreateComplianceRuleInput>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ComplianceRuleDraft>(EMPTY_COMPLIANCE_RULE_DRAFT);
  const active = activeWorkspaceRules(rules);
  const ready = draft.title.trim() && draft.conditionKey.trim();
  const set = (patch: Partial<ComplianceRuleDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function submit() {
    if (!ready) return;
    await onCreateRule(toCreateComplianceRuleInput(draft));
    setDraft(EMPTY_COMPLIANCE_RULE_DRAFT);
  }

  return (
    <section id="compliance-rules" aria-labelledby="compliance-rules-title" className="scroll-mt-6 rounded-xl border border-border bg-card">
      <header className="flex items-start gap-2 border-b border-border px-5 py-4">
        <ShieldCheck className="mt-0.5 size-4 text-primary" aria-hidden />
        <div>
          <h2 id="compliance-rules-title" className="text-sm font-semibold text-foreground">Compliance rules</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Rules apply to every event. Each event's Closure → Compliance step runs them and records the results.</p>
        </div>
      </header>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{active.length} active workspace rule{active.length === 1 ? "" : "s"}</h3>
          {active.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No custom rules yet. Built-in checks still run for every event.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {active.map((rule) => (
                <li key={rule.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-foreground">{rule.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceOptionLabel(COMPLIANCE_RULE_PHASES, rule.phase)} · {complianceOptionLabel(COMPLIANCE_RULE_SEVERITIES, rule.severity)}
                    {rule.note ? ` · ${rule.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form
          className="grid content-start gap-3 rounded-lg border border-border bg-muted/20 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h3 className="text-sm font-semibold text-foreground">Add a rule</h3>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Rule title
            <input value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder="Venue power capacity confirmed" className={FIELD} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Check identifier
            <input value={draft.conditionKey} onChange={(event) => set({ conditionKey: event.target.value })} placeholder="e.g. venue_power_capacity" className={FIELD} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Phase
              <select value={draft.phase} onChange={(event) => set({ phase: event.target.value })} className={FIELD}>
                {COMPLIANCE_RULE_PHASES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Severity
              <select value={draft.severity} onChange={(event) => set({ severity: event.target.value })} className={FIELD}>
                {COMPLIANCE_RULE_SEVERITIES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            PMCM note
            <textarea value={draft.note} onChange={(event) => set({ note: event.target.value })} className="min-h-20 rounded-md border border-border bg-background p-3 text-sm" />
          </label>
          <button type="submit" disabled={busy || !ready} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <Plus className="size-4" aria-hidden /> Add rule
          </button>
        </form>
      </div>
    </section>
  );
}
