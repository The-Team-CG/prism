"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { useEffect, useState } from "react";
import type { PrismWrapUpSection } from "@prism/types";
import { useEventWrapUpViewModel } from "../view-models/use-event-wrap-up-view-model";
import { WRAP_UP_LOGISTICS_KEY, wrapUpLogisticsMirror, wrapUpWritableRequiredItems } from "../model/wrap-up-rules";

type WrapUpSectionsDraft = Record<"issues" | "feedback", Pick<PrismWrapUpSection, "status" | "evidence" | "completedAt">>;

export function EventWrapUpView({ eventId }: { eventId: string }) {
  const vm = useEventWrapUpViewModel(eventId);
  const [requiredItems, setRequiredItems] = useState<Record<string, boolean>>({});
  const [sections, setSections] = useState<WrapUpSectionsDraft>({
    issues: { status: "pending", evidence: "", completedAt: null },
    feedback: { status: "pending", evidence: "", completedAt: null },
  });
  useEffect(() => {
    if (!vm.record) return;
    setRequiredItems(vm.record.requiredItems);
    setSections({ issues: vm.record.sections.issues, feedback: vm.record.sections.feedback });
  }, [vm.record]);
  if (vm.error) return <p className="text-sm text-attention">{vm.error}</p>;
  if (!vm.record) return <div className="flex flex-wrap gap-2"><button type="button" disabled={vm.busy} onClick={() => void vm.start({ mode: "full" })} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Start full wrap-up</button><button type="button" disabled={vm.busy} onClick={() => void vm.start({ mode: "quick" })} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Start quick wrap-up</button></div>;
  const logistics = wrapUpLogisticsMirror(vm.record);
  const editableItems = Object.entries(requiredItems).filter(([key]) => key !== WRAP_UP_LOGISTICS_KEY);
  return <section className="rounded-lg border border-border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-muted-foreground">Post-event wrap-up</p><h2 className="text-xl font-black">{vm.record.mode === "quick" ? "Quick" : "Full"} wrap-up</h2></div><span className="text-sm text-muted-foreground">{vm.progress.completed}/{vm.progress.total} complete · {vm.reminder}</span></div>
    <p className="mt-2 text-sm text-muted-foreground">Activated {formatPortalDateTime(vm.record.activatedAt)}; deadline {formatPortalDateTime(vm.record.deadlineAt)}. Reminder checkpoints do not archive the event.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm" data-testid="wrap-up-logistics-mirror">
        <span className="mt-0.5 size-4 shrink-0 rounded-sm border border-border text-center leading-4" aria-hidden="true">{logistics.complete ? "✓" : ""}</span>
        <span><span className="block font-semibold">Logistics</span><span className="text-muted-foreground">{logistics.label}</span></span>
      </div>
      {editableItems.map(([key, checked]) => <label key={key} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => setRequiredItems((current) => ({ ...current, [key]: event.target.checked }))} /> <span className="capitalize">{key.replaceAll("_", " ")}</span></label>)}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(sections).map(([key, section]) => <div key={key} className="rounded-md border border-border p-3 text-sm"><p className="font-semibold capitalize">{key}</p><select value={section.status} onChange={(event) => setSections((current) => ({ ...current, [key]: { ...section, status: event.target.value as typeof section.status } }))} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1"><option value="pending">Pending</option><option value="complete">Complete</option><option value="blocked">Blocked</option></select><textarea value={section.evidence} onChange={(event) => setSections((current) => ({ ...current, [key]: { ...section, evidence: event.target.value } }))} placeholder="Close evidence" className="mt-2 min-h-20 w-full rounded-md border border-border bg-background p-2 text-xs" /></div>)}</div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={vm.busy} onClick={() => void vm.update({ requiredItems: wrapUpWritableRequiredItems(requiredItems), sections })} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Save wrap-up evidence</button><button type="button" disabled={vm.busy || Boolean(vm.record.clientAcknowledgedAt)} onClick={() => void vm.update({ requiredItems: wrapUpWritableRequiredItems(requiredItems), sections, clientAcknowledged: true, clientAcknowledgementNote: "Client acknowledgement recorded by PMCM." })} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{vm.record.clientAcknowledgedAt ? "Client acknowledged" : "Record client acknowledgement"}</button></div>
  </section>;
}
