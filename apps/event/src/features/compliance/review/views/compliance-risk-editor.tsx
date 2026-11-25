"use client";

import { useState } from "react";
import type { PrismComplianceRisk, UpdateComplianceRiskInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { Textarea } from "@prism/ui/components/textarea";
import { SegmentedControl } from "@/features/pmcm-kit";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
] as const;
type RiskStatus = (typeof STATUSES)[number]["value"];

const STATUS_HINT: Record<RiskStatus, string> = {
  open: "Still a live risk for this event.",
  mitigated: "The mitigation is in place; the risk is reduced.",
  accepted: "PMCM accepts the risk as it is.",
  closed: "It can no longer happen, or the event is past it.",
};

/** "Update" on a risk row, and the side panel where PMCM moves it along: where it stands, who owns it, how it is handled and why. */
export function ComplianceRiskUpdate({ risk, busy, onSave }: { risk: PrismComplianceRisk; busy: boolean; onSave: (riskId: string, input: UpdateComplianceRiskInput) => Promise<boolean> }) {
  const current = STATUSES.find((option) => option.value === risk.status)?.value ?? "open";
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RiskStatus>(current);
  const [owner, setOwner] = useState(risk.owner);
  const [mitigation, setMitigation] = useState(risk.mitigation);
  const [reason, setReason] = useState("");
  const id = `risk-${risk.id}`;

  function start() {
    setStatus(current);
    setOwner(risk.owner);
    setMitigation(risk.mitigation);
    setReason("");
    setOpen(true);
  }

  async function save() {
    const saved = await onSave(risk.id, { status, owner: owner.trim() || undefined, mitigation: mitigation.trim() || undefined, reason: reason.trim() || undefined });
    if (saved) setOpen(false);
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={start} aria-label={`Update ${risk.title}`}>Update</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update risk</SheetTitle>
            <SheetDescription>{risk.title}</SheetDescription>
          </SheetHeader>
          <form aria-label={`Update ${risk.title}`} className="grid min-w-0 content-start gap-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <Field>
              <FieldLabel id={`${id}-status`}>Status</FieldLabel>
              <SegmentedControl label="Status" options={STATUSES} value={status} onChange={(value) => setStatus(value as RiskStatus)} />
              <FieldDescription>{STATUS_HINT[status]}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-owner`}>Owner</FieldLabel>
              <Input id={`${id}-owner`} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Who follows it up" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-mitigation`}>Mitigation</FieldLabel>
              <Textarea id={`${id}-mitigation`} value={mitigation} onChange={(event) => setMitigation(event.target.value)} className="min-h-20" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-reason`}>Why it changed (optional)</FieldLabel>
              <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Backup generator confirmed on site" />
              <FieldDescription>Kept with the risk's history for the audit trail.</FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save risk"}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
