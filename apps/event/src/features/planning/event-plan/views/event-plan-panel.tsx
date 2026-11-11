"use client";

import { ListChecks } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { PrismEmptyLine, PrismStatRow } from "@prism/ui/page-blocks";
import { useEventPlanViewModel } from "../view-models/use-event-plan-view-model";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { EditTaskDialog } from "./edit-task-dialog";
import { PlanTaskRow } from "./plan-task-row";

/**
 * An event's planning tasks, built from PMCM's templates. Applying a template is a preview first and then a confirmation,
 * and applying it again later never rewrites finished or edited work.
 */
export function EventPlanPanel({ eventId, archived = false }: { eventId: string; archived?: boolean }) {
  const vm = useEventPlanViewModel(eventId);
  const { progress } = vm;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PrismStatRow
          label="Plan progress"
          stats={[
            { label: "Open tasks", value: progress.open, empty: progress.open === 0 },
            { label: "Done", value: progress.done, empty: progress.done === 0 },
            { label: "Overdue", value: progress.overdue, tone: progress.overdue > 0 ? "attention" : "neutral", empty: progress.overdue === 0 },
          ]}
        />
        <Button disabled={archived} onClick={vm.openApply} className="rounded-lg font-semibold"><ListChecks className="size-4" /> Apply a template</Button>
      </div>
      {archived ? <p className="text-xs text-muted-foreground">This event is archived, so its plan can no longer change.</p> : null}
      {vm.loadError ? <p role="alert" className="text-sm text-destructive">{vm.loadError}</p> : null}
      {!vm.dialog && vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.groups.length === 0 && !vm.loadError ? (
        <PrismEmptyLine icon={ListChecks}>{vm.status === "pending" ? "Loading the plan…" : "No planning tasks yet. Apply a template to date and assign them from the event date."}</PrismEmptyLine>
      ) : null}
      {vm.groups.map((group) => (
        <section key={group.templateId} aria-label={`${group.templateName} tasks`} className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{group.templateName}</h3>
          <ul className="divide-y divide-border">
            {group.items.map((item) => <PlanTaskRow key={item.id} item={item} busy={vm.busy || archived} onToggle={() => void vm.toggle(item)} onEdit={() => vm.openEdit(item.id)} />)}
          </ul>
        </section>
      ))}
      <ApplyTemplateDialog vm={vm} />
      <EditTaskDialog vm={vm} />
    </div>
  );
}
