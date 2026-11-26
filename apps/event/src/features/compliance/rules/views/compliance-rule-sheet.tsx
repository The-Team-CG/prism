"use client";

import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { Textarea } from "@prism/ui/components/textarea";
import {
  COMPLIANCE_RULE_PHASES,
  COMPLIANCE_RULE_SEVERITIES,
  type ComplianceRuleDraft,
} from "../model/compliance-rule-rules";

/** The add/edit form for one compliance rule; the owner holds the draft and decides what saving does. */
export function ComplianceRuleSheet({
  open,
  editing,
  draft,
  ready,
  busy,
  onChange,
  onSubmit,
  onTurnOff,
  onClose,
}: {
  open: boolean;
  /** True while changing an existing rule, false while adding a new one. */
  editing: boolean;
  draft: ComplianceRuleDraft;
  /** The draft has what a rule needs to be saved. */
  ready: boolean;
  busy: boolean;
  onChange: (patch: Partial<ComplianceRuleDraft>) => void;
  onSubmit: () => void;
  onTurnOff: () => void;
  onClose: () => void;
}) {
  const heading = editing ? "Edit rule" : "Add a rule";
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>{editing ? "Changes apply to the next compliance run on every event." : "It runs for every event at its phase, beside the built-in checks."}</SheetDescription>
        </SheetHeader>
        <form
          aria-label={heading}
          className="grid content-start gap-4 px-4 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="compliance-rule-title">Rule title</FieldLabel>
              <Input id="compliance-rule-title" value={draft.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Venue power capacity confirmed" />
            </Field>
            <Field>
              <FieldLabel htmlFor="compliance-rule-key">Check identifier</FieldLabel>
              <Input id="compliance-rule-key" value={draft.conditionKey} onChange={(event) => onChange({ conditionKey: event.target.value })} placeholder="e.g. venue_power_capacity" readOnly={editing} />
              {editing ? <FieldDescription>Results are recorded against it, so it stays as created.</FieldDescription> : null}
            </Field>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="compliance-rule-phase">Phase</FieldLabel>
                <Select value={draft.phase} onValueChange={(phase) => onChange({ phase })}>
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
                <Select value={draft.severity} onValueChange={(severity) => onChange({ severity })}>
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
              <Textarea id="compliance-rule-note" value={draft.note} onChange={(event) => onChange({ note: event.target.value })} className="min-h-20" />
            </Field>
          </FieldGroup>
          <Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !ready}>
                Save rule
              </Button>
              {editing ? <Button type="button" variant="outline" disabled={busy} onClick={onTurnOff}>Turn off rule</Button> : null}
            </div>
            {ready ? null : <FieldDescription>Add a rule title and a check identifier to save the rule.</FieldDescription>}
          </Field>
        </form>
      </SheetContent>
    </Sheet>
  );
}
