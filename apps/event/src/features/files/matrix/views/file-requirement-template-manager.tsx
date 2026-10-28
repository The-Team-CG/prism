"use client";

import type { FileRequirementRole } from "@prism/types";
import { roleLabel } from "@/features/pmcm-kit/model/display-labels";
import { useFileRequirementTemplateManagerViewModel } from "../view-models/use-file-requirement-template-manager-view-model";

const roles: FileRequirementRole[] = ["client", "supplier", "coordinator", "pmcm-admin"];

export function FileRequirementTemplateManager({ eventId, onClose, onApplied }: { eventId: string; onClose: () => void; onApplied: () => void }) {
  const vm = useFileRequirementTemplateManagerViewModel(eventId, onApplied);
  return (
    <section aria-label="Event type requirement templates" className="space-y-4 border-t border-border bg-secondary/30 px-6 py-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-foreground">Event type templates</h3><p className="mt-1 text-xs text-muted-foreground">PMCM manages reusable requirements. Applying a template adds missing keys only.</p></div><button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Close</button></div>
      <label className="grid max-w-lg gap-1 text-xs font-semibold text-muted-foreground">Event type
        <input list="file-requirement-template-types" value={vm.eventType} onChange={(event) => vm.setEventType(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Wedding" />
        <datalist id="file-requirement-template-types">{vm.templates.map((template) => <option key={template.id} value={template.eventType} />)}</datalist>
      </label>
      <div className="space-y-2">
        {vm.requirements.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_1.4fr_1fr_8rem_auto]">
          <label className="grid gap-1 text-2xs text-muted-foreground">Key<input value={item.key} onChange={(event) => vm.changeRequirement(index, { key: event.target.value })} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground" placeholder="venue_permit" /></label>
          <label className="grid gap-1 text-2xs text-muted-foreground">Requirement<input value={item.label} onChange={(event) => vm.changeRequirement(index, { label: event.target.value })} className="min-w-0 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground" placeholder="Venue permit" /></label>
          <label className="grid gap-1 text-2xs text-muted-foreground">Owner<select value={item.ownerRole} onChange={(event) => vm.changeRequirement(index, { ownerRole: event.target.value as FileRequirementRole })} className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <label className="grid gap-1 text-2xs text-muted-foreground">Days before event<input type="number" min="0" max="3650" value={item.dueOffsetDays ?? ""} onChange={(event) => vm.changeRequirement(index, { dueOffsetDays: event.target.value === "" ? undefined : Number(event.target.value) })} className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground" /></label>
          <button type="button" disabled={vm.requirements.length === 1} onClick={() => vm.removeRequirement(index)} className="self-end rounded border border-border px-2 py-1.5 text-xs disabled:opacity-50" aria-label={`Remove ${item.label || "requirement"}`}>Remove</button>
          <label className="flex items-center gap-2 text-xs text-foreground md:col-span-5"><input type="checkbox" checked={item.required} onChange={(event) => vm.changeRequirement(index, { required: event.target.checked })} />Required · visible to PMCM and the owner</label>
        </div>)}
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={vm.addRequirement} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Add row</button><button type="button" disabled={vm.busy} onClick={() => void vm.save()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60">{vm.busy ? "Saving…" : "Save template"}</button><button type="button" disabled={vm.busy} onClick={() => void vm.apply()} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">Apply to this event</button></div>
      {vm.message ? <p role="status" className="text-xs text-muted-foreground">{vm.message}</p> : null}
    </section>
  );
}
