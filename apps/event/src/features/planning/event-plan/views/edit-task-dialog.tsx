"use client";

import { useState } from "react";
import type { PlanItemStatus, PrismEventPlanItem } from "@prism/types";
import { PLAN_ITEM_STATUSES } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { PLAN_STATUS_LABELS } from "../model/plan-rules";
import { draftFromTask, type TaskDraft } from "../use-cases/plan-commands";
import type { EventPlanViewModel } from "../view-models/use-event-plan-view-model";

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground">{label}{children}</label>;
}

function EditForm({ vm, item }: { vm: EventPlanViewModel; item: PrismEventPlanItem }) {
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(item));
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => { if (!open) vm.closeDialog(); }}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogDescription>{item.templateName}, version {item.templateVersion}</DialogDescription>
          <DialogTitle className="truncate text-base font-semibold">Edit task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          <Labelled label="Title"><Input value={draft.title} onChange={(event) => set("title", event.target.value)} /></Labelled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled label="Owner role"><Input value={draft.ownerRole} onChange={(event) => set("ownerRole", event.target.value)} /></Labelled>
            <Labelled label="Person doing it"><Input value={draft.ownerName} onChange={(event) => set("ownerName", event.target.value)} placeholder="Optional" /></Labelled>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Due
              <span className="font-normal"><DatePicker value={draft.dueDate} onValueChange={(value) => set("dueDate", value)} aria-label="Due" className="h-10" /></span>
            </label>
            <div className="grid gap-1.5 text-sm font-semibold text-foreground">
              <span id="plan-status-label">Status</span>
              <Select value={draft.status} onValueChange={(next) => set("status", next as PlanItemStatus)}>
                <SelectTrigger aria-labelledby="plan-status-label" className="h-10 w-full rounded-lg text-sm font-normal"><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_ITEM_STATUSES.map((status) => <SelectItem key={status} value={status}>{PLAN_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Labelled label="Notes"><Input value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></Labelled>
          <p className="text-xs text-muted-foreground">Changing the title, owner role, due date or notes keeps this task from being rewritten when a template is applied again.</p>
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-lg font-semibold" onClick={vm.closeDialog}>Cancel</Button>
          <Button disabled={vm.busy} onClick={() => void vm.saveTask(item, draft)} className="rounded-lg font-semibold">{vm.busy ? "Saving…" : "Save task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditTaskDialog({ vm }: { vm: EventPlanViewModel }) {
  return vm.dialog?.kind === "edit" && vm.editing ? <EditForm key={vm.editing.id} vm={vm} item={vm.editing} /> : null;
}
