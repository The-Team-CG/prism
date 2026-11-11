"use client";

import { useState, type ReactNode } from "react";
import { useResource } from "@prism/portal-query";
import type { PrismPlanningTemplate } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Input } from "@prism/ui/components/input";
import { planningTemplate } from "../data/templates-repository";
import { draftFromItems, emptyDraft, type TemplateDraft } from "../model/template-draft";
import type { PlanningTemplatesViewModel } from "../view-models/use-planning-templates-view-model";
import { TemplateItemRows } from "./template-item-rows";

function Frame({ vm, eyebrow, title, submitLabel, onSubmit, children }: {
  vm: PlanningTemplatesViewModel;
  eyebrow: string;
  title: string;
  submitLabel?: string;
  onSubmit?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) vm.closeDialog(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogDescription>{eyebrow}</DialogDescription>
          <DialogTitle className="truncate text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          {children}
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-lg font-semibold" onClick={vm.closeDialog}>Cancel</Button>
          {onSubmit ? <Button disabled={vm.busy} onClick={onSubmit} className="rounded-lg font-semibold">{vm.busy ? "Saving…" : submitLabel}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const TASKS_HINT = "Each task has an owner and falls a number of days before or after the event date. Applying the template to an event dates them from that event.";

function NewTemplate({ vm }: { vm: PlanningTemplatesViewModel }) {
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  return (
    <Frame vm={vm} eyebrow="Tasks, dates and owners only" title="New planning template" submitLabel="Create template" onSubmit={() => void vm.create(draft)}>
      <Labelled label="Name">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Corporate event" />
      </Labelled>
      <Labelled label="Description (optional)">
        <Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </Labelled>
      <p className="text-xs text-muted-foreground">{TASKS_HINT}</p>
      <TemplateItemRows items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
    </Frame>
  );
}

function EditForm({ vm, template }: { vm: PlanningTemplatesViewModel; template: PrismPlanningTemplate }) {
  const current = template.versions[0]!;
  const [draft, setDraft] = useState<TemplateDraft>(() => ({ name: template.name, description: template.description, changeNote: "", items: draftFromItems(current.items) }));
  return (
    <Frame
      vm={vm}
      eyebrow={`Version ${template.currentVersion} is current. Publishing creates version ${template.currentVersion + 1}`}
      title={template.name}
      submitLabel={`Publish version ${template.currentVersion + 1}`}
      onSubmit={() => void vm.publish(template.id, draft)}
    >
      <p className="text-xs text-muted-foreground">
        Earlier versions stay exactly as published. An event keeps the tasks it already has until you apply the new version to it, and
        finished or edited tasks are never rewritten. {TASKS_HINT}
      </p>
      <Labelled label="What changed (optional)">
        <Input value={draft.changeNote} onChange={(event) => setDraft({ ...draft, changeNote: event.target.value })} placeholder="Confirm the venue earlier" />
      </Labelled>
      <TemplateItemRows items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
    </Frame>
  );
}

function EditTemplate({ vm, templateId }: { vm: PlanningTemplatesViewModel; templateId: string }) {
  const loaded = useResource(planningTemplate, templateId);
  if (loaded.status === "ready") return <EditForm vm={vm} template={loaded.data} />;
  const message = loaded.status === "error" ? loaded.error.message : "Loading the template…";
  return <Frame vm={vm} eyebrow="Planning template" title="Edit template"><p className="text-sm text-muted-foreground">{message}</p></Frame>;
}

/** Renders whichever dialog the catalogue has open. Each remounts when opened, so its fields start fresh. */
export function TemplateEditorDialog({ vm }: { vm: PlanningTemplatesViewModel }) {
  const { dialog } = vm;
  if (!dialog) return null;
  return dialog.kind === "new" ? <NewTemplate vm={vm} /> : <EditTemplate vm={vm} templateId={dialog.templateId} />;
}
