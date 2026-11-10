"use client";

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import type { PrismComplianceRule } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@prism/ui/components/item";
import {
  COMPLIANCE_RULE_PHASES,
  COMPLIANCE_RULE_SEVERITIES,
  EMPTY_COMPLIANCE_RULE_DRAFT,
  activeWorkspaceRules,
  complianceOptionLabel,
  toCreateComplianceRuleInput,
  type ComplianceRuleDraft,
} from "../model/compliance-rule-rules";

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
  const ready = draft.title.trim().length > 0 && draft.conditionKey.trim().length > 0;
  const set = (patch: Partial<ComplianceRuleDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function submit() {
    if (!ready) return;
    await onCreateRule(toCreateComplianceRuleInput(draft));
    setDraft(EMPTY_COMPLIANCE_RULE_DRAFT);
  }

  return (
    <Card id="compliance-rules" aria-labelledby="compliance-rules-title" className="scroll-mt-6 gap-0 py-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 text-primary" aria-hidden />
          <div className="grid gap-1">
            <CardTitle id="compliance-rules-title" className="text-sm font-semibold">Compliance rules</CardTitle>
            <CardDescription>Rules apply to every event. Each event's Closure → Compliance step runs them and records the results.</CardDescription>
          </div>
        </div>
        <CardAction>
          <span className="text-sm tabular-nums text-muted-foreground">{active.length} active</span>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 p-5">
        <section aria-label="Active workspace rules" className="grid content-start gap-3">
          <h3 className="text-sm font-semibold text-foreground">Active workspace rules</h3>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom rules yet. Built-in checks still run for every event.</p>
          ) : (
            <ul className="grid gap-2">
              {active.map((rule) => (
                <li key={rule.id}>
                  <Item variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>{rule.title}</ItemTitle>
                      <ItemDescription>
                        {complianceOptionLabel(COMPLIANCE_RULE_PHASES, rule.phase)} · {complianceOptionLabel(COMPLIANCE_RULE_SEVERITIES, rule.severity)}
                        {rule.note ? ` · ${rule.note}` : ""}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          aria-label="Add a rule"
          className="grid content-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h3 className="text-sm font-semibold text-foreground">Add a rule</h3>
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="compliance-rule-title">Rule title</FieldLabel>
              <Input id="compliance-rule-title" value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder="Venue power capacity confirmed" />
            </Field>
            <Field>
              <FieldLabel htmlFor="compliance-rule-key">Check identifier</FieldLabel>
              <Input id="compliance-rule-key" value={draft.conditionKey} onChange={(event) => set({ conditionKey: event.target.value })} placeholder="e.g. venue_power_capacity" />
            </Field>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="compliance-rule-phase">Phase</FieldLabel>
                <Select value={draft.phase} onValueChange={(phase) => set({ phase })}>
                  <SelectTrigger id="compliance-rule-phase" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_RULE_PHASES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="compliance-rule-severity">Severity</FieldLabel>
                <Select value={draft.severity} onValueChange={(severity) => set({ severity })}>
                  <SelectTrigger id="compliance-rule-severity" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_RULE_SEVERITIES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="compliance-rule-note">PMCM note</FieldLabel>
              <Textarea id="compliance-rule-note" value={draft.note} onChange={(event) => set({ note: event.target.value })} className="min-h-20" />
            </Field>
          </FieldGroup>
          <Field>
            <div>
              <Button type="submit" disabled={busy || !ready}>
                <Plus aria-hidden /> Add rule
              </Button>
            </div>
            {ready ? null : <FieldDescription>Add a rule title and a check identifier to save the rule.</FieldDescription>}
          </Field>
        </form>
      </CardContent>
    </Card>
  );
}
