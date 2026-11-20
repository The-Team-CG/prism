"use client";

import { useState } from "react";
import { Ellipsis, MapPin, Truck, UserRound, Zap, type LucideIcon } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { cn } from "@/app/components/ui/utils";
import { QUICK_ISSUE_TYPES, quickIssueTitle, type QuickIssueType } from "../../model/coordinator-shift";
import { CoordinatorIssueFormFields, type CoordinatorIssueFormModel } from "./coordinator-role-sections";
import { FIELD_AREA, FORM_ALERT } from "./coordinator-view-primitives";

const TYPE_ICON: Record<QuickIssueType, LucideIcon> = {
  Supplier: Truck,
  Guest: UserRound,
  Equipment: Zap,
  "Venue or safety": MapPin,
  Other: Ellipsis,
};

const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const CHIP = "min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary focus-visible:ring-2 focus-visible:ring-ring";

function ChipGroup<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn(CHIP, option.icon && "flex items-center gap-2")}>
          {option.icon ? <option.icon className="size-4 shrink-0" aria-hidden /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Reporting an issue in a few taps: what kind, where, an optional note, send. Severity starts at High because that is
 * what most on-site reports are. "More details" opens the full form with what was chosen so far.
 */
export function CoordinatorQuickReport({ issueForm, areas, onDone }: { issueForm: CoordinatorIssueFormModel; areas: string[]; onDone: () => void }) {
  const [type, setType] = useState<QuickIssueType | null>(null);
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState("high");
  const [detailed, setDetailed] = useState(false);

  function openDetails() {
    if (type) issueForm.setTitle(quickIssueTitle(type, note, area));
    issueForm.setAffectedArea(area);
    issueForm.setDescription(note);
    issueForm.setSeverity(severity);
    setDetailed(true);
  }

  async function send() {
    if (!type) return;
    const sent = await issueForm.submit({ title: quickIssueTitle(type, note, area), severity, affectedArea: area, description: note.trim() });
    if (sent) onDone();
  }

  if (detailed) return <CoordinatorIssueFormFields issueForm={issueForm} onDone={onDone} />;
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">What kind of problem?</p>
        <ChipGroup
          label="Kind of problem"
          options={QUICK_ISSUE_TYPES.map((value) => ({ value, label: value, icon: TYPE_ICON[value] }))}
          value={type}
          onChange={setType}
          className="grid grid-cols-2 [&>button]:justify-start"
        />
      </div>
      {areas.length ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium text-foreground">Where?</p>
          <ChipGroup label="Where" options={areas.map((value) => ({ value, label: value }))} value={area || null} onChange={(next) => setArea(next === area ? "" : next)} />
        </div>
      ) : null}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-foreground">What happened? <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Caterer 30 minutes late, no word yet" className={FIELD_AREA} />
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">How serious?</p>
        <ChipGroup label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
      </div>
      {issueForm.error ? <p role="alert" className={FORM_ALERT}>{issueForm.error}</p> : null}
      <Button type="button" className="min-h-12 text-base font-semibold" disabled={!type || issueForm.busy} onClick={() => void send()}>
        {issueForm.busy ? "Sending…" : type ? "Send to PMCM" : "Pick what kind first"}
      </Button>
      <button type="button" onClick={openDetails} className="justify-self-center text-sm font-medium text-primary">More details (deadline, who handles it)</button>
    </div>
  );
}
