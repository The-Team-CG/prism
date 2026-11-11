"use client";

import { useState } from "react";
import type { PrismPlanPreview } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDate } from "@prism/ui/format-date";
import { KEPT_REASON_LABELS, changeLabel, previewIsEmpty, previewSummary } from "../model/plan-rules";
import type { EventPlanViewModel } from "../view-models/use-event-plan-view-model";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <ul className="grid gap-1.5 text-sm">{children}</ul>
    </section>
  );
}

/** What applying would do, spelled out task by task. Nothing has changed yet: this is only the preview. */
function PreviewBody({ preview }: { preview: PrismPlanPreview }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-foreground">
        {preview.templateName}, version {preview.version}, dated from the event on {formatPortalDate(preview.eventDate)}.{" "}
        {previewSummary(preview).join(". ") || "Nothing to add or change."}
      </p>
      {preview.add.length > 0 ? (
        <Section title="Will be added">
          {preview.add.map((entry) => (
            <li key={entry.key}>
              {entry.title} · due {formatPortalDate(entry.dueDate)} · {entry.ownerRole}
              {entry.pastDue ? <span className="font-semibold"> · already past due</span> : null}
            </li>
          ))}
        </Section>
      ) : null}
      {preview.update.length > 0 ? (
        <Section title="Will be updated">
          {preview.update.map((entry) => (
            <li key={entry.id}>{entry.title}<span className="block text-xs text-muted-foreground">{entry.changes.map(changeLabel).join(" · ")}</span></li>
          ))}
        </Section>
      ) : null}
      {preview.kept.length > 0 ? (
        <Section title="Kept as they are">
          {preview.kept.map((entry) => (
            <li key={entry.id}>{entry.title}<span className="block text-xs text-muted-foreground">{KEPT_REASON_LABELS[entry.reason]}. The template would have: {entry.changes.map(changeLabel).join(" · ")}</span></li>
          ))}
        </Section>
      ) : null}
      {preview.removedFromTemplate.length > 0 ? (
        <Section title="No longer in this template (left on the plan)">
          {preview.removedFromTemplate.map((entry) => <li key={entry.id}>{entry.title}</li>)}
        </Section>
      ) : null}
    </div>
  );
}

function TemplatePicker({ vm }: { vm: EventPlanViewModel }) {
  const [templateId, setTemplateId] = useState("");
  const chosen = vm.applicable.find((template) => template.id === templateId);
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 text-sm font-semibold text-foreground">
        <span id="plan-template-label">Template</span>
        <Select value={templateId} onValueChange={(next) => { setTemplateId(next); vm.clearPreview(); }}>
          <SelectTrigger aria-labelledby="plan-template-label" className="h-10 w-full rounded-lg text-sm font-normal"><SelectValue placeholder="Choose a template" /></SelectTrigger>
          <SelectContent>
            {vm.applicable.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · version {template.currentVersion}, {template.itemCount} tasks</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs font-normal text-muted-foreground">
          {chosen ? "Preview shows what would change. Nothing is applied until you confirm." : "Applying the same template again is safe: finished and edited tasks are left alone."}
        </span>
      </div>
      <Button variant="outline" className="justify-self-start" disabled={!chosen || vm.busy} onClick={() => void vm.showPreview(templateId)}>
        {vm.preview ? "Preview again" : "Preview"}
      </Button>
    </div>
  );
}

export function ApplyTemplateDialog({ vm }: { vm: EventPlanViewModel }) {
  if (vm.dialog?.kind !== "apply") return null;
  const { preview } = vm;
  const nothingToDo = preview ? previewIsEmpty(preview) : false;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) vm.closeDialog(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogDescription>Tasks, dates and owners only</DialogDescription>
          <DialogTitle className="text-base font-semibold">Apply a planning template</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 px-6 py-5">
          <TemplatePicker vm={vm} />
          {preview ? <PreviewBody preview={preview} /> : null}
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-lg font-semibold" onClick={vm.closeDialog}>Cancel</Button>
          <Button disabled={!preview || nothingToDo || vm.busy} onClick={() => void vm.apply()} className="rounded-lg font-semibold">
            {vm.busy ? "Working…" : "Apply to the plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
