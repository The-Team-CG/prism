"use client";

import { ListChecks, Plus } from "lucide-react";
import type { PrismPlanningTemplateSummary } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismEmptyLine } from "@prism/ui/page-blocks";
import { usePlanningTemplatesViewModel, type PlanningTemplatesViewModel } from "../view-models/use-planning-templates-view-model";
import { TemplateEditorDialog } from "./template-editor-dialog";

function TemplateRow({ template, vm }: { template: PrismPlanningTemplateSummary; vm: PlanningTemplatesViewModel }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className={template.archived ? "text-sm font-semibold text-muted-foreground" : "text-sm font-semibold text-foreground"}>
          {template.name}{template.archived ? " (archived)" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Version {template.currentVersion} · {template.itemCount} {template.itemCount === 1 ? "task" : "tasks"} · updated {formatPortalDate(template.updatedAt)}
        </p>
        {template.description ? <p className="text-xs text-muted-foreground">{template.description}</p> : null}
      </div>
      <div className="flex gap-2">
        {template.archived ? null : <Button size="sm" variant="outline" onClick={() => vm.openEdit(template.id)}>Edit</Button>}
        <Button size="sm" variant="ghost" disabled={vm.busy} onClick={() => void vm.setArchived(template.id, !template.archived)}>
          {template.archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </li>
  );
}

/** Settings → Planning templates: reusable task lists PMCM applies to events. Tasks, dates and owners only. */
export function PlanningTemplatesSettings() {
  const vm = usePlanningTemplatesViewModel();
  return (
    <Card id="planning-templates" aria-labelledby="planning-templates-title" className="scroll-mt-6 gap-0 py-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-2">
          <ListChecks className="mt-0.5 size-4 text-primary" aria-hidden />
          <div className="grid gap-1">
            <CardTitle id="planning-templates-title" className="text-sm font-semibold">Planning templates</CardTitle>
            <CardDescription>
              Reusable task lists with an owner and a date counted from the event date. Apply one from an event's Briefing → Plan.
              Templates never hold payment milestones or amounts.
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button size="sm" onClick={vm.openNew}><Plus className="size-4" /> New template</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {vm.loadError ? <p role="alert" className="text-sm text-destructive">{vm.loadError}</p> : null}
        {vm.templates.length === 0 && !vm.loadError ? (
          <PrismEmptyLine icon={ListChecks}>{vm.status === "pending" ? "Loading templates…" : "No planning templates yet. Create one to reuse a task list across events."}</PrismEmptyLine>
        ) : (
          <ul className="divide-y divide-border">{vm.templates.map((template) => <TemplateRow key={template.id} template={template} vm={vm} />)}</ul>
        )}
        {vm.error && !vm.dialog ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      </CardContent>
      <TemplateEditorDialog vm={vm} />
    </Card>
  );
}
