"use client";

import { useState } from "react";
import type { PrismComplianceRisk, UpdateComplianceRiskInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

const STATUSES = [["open", "Open"], ["mitigated", "Mitigated"], ["accepted", "Accepted"], ["closed", "Closed"]] as const;
type RiskStatus = (typeof STATUSES)[number][0];

/** One risk's follow-up: where it stands, who owns it, how it is handled, and why it moved. */
export function ComplianceRiskEditor({ risk, busy, onSave }: { risk: PrismComplianceRisk; busy: boolean; onSave: (riskId: string, input: UpdateComplianceRiskInput) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RiskStatus>((STATUSES.find(([value]) => value === risk.status)?.[0]) ?? "open");
  const [owner, setOwner] = useState(risk.owner);
  const [mitigation, setMitigation] = useState(risk.mitigation);
  const [reason, setReason] = useState("");
  if (!open) return <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`Update ${risk.title}`}>Update</Button>;
  const id = `risk-${risk.id}`;
  async function save() {
    const saved = await onSave(risk.id, { status, owner: owner.trim() || undefined, mitigation: mitigation.trim() || undefined, reason: reason.trim() || undefined });
    if (saved) { setOpen(false); setReason(""); }
  }
  return (
    <div role="group" aria-label={`Update ${risk.title}`} className="mt-2 grid gap-2 rounded-md border border-border bg-background p-3">
      <Field>
        <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
        <Select value={status} onValueChange={(value) => setStatus(value as RiskStatus)}>
          <SelectTrigger id={`${id}-status`} className="w-full min-w-0 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <label htmlFor={`${id}-owner`} className="text-sm font-medium">Owner</label>
      <input id={`${id}-owner`} value={owner} onChange={(event) => setOwner(event.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
      <label htmlFor={`${id}-mitigation`} className="text-sm font-medium">Mitigation</label>
      <textarea id={`${id}-mitigation`} value={mitigation} onChange={(event) => setMitigation(event.target.value)} className="min-h-16 rounded-md border border-border bg-card p-3 text-sm" />
      <label htmlFor={`${id}-reason`} className="text-sm font-medium">Why it changed (optional)</label>
      <input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Backup generator confirmed on site" className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save risk"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
