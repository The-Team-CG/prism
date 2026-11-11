"use client";

import type { PrismEventPlanItem } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { formatPortalDate } from "@prism/ui/format-date";
import { ownerLabel } from "../model/plan-rules";

/** What deserves a glance on a task, in plain words. Never colour alone. */
function flags(item: PrismEventPlanItem): string[] {
  return [
    item.overdue ? "Overdue" : "",
    item.waiting && item.dependsOnTitle ? `Waiting for ${item.dependsOnTitle}` : "",
    item.status === "skipped" ? "Skipped" : "",
    item.customized ? "Edited" : "",
  ].filter(Boolean);
}

export function PlanTaskRow({ item, busy, onToggle, onEdit }: { item: PrismEventPlanItem; busy: boolean; onToggle: () => void; onEdit: () => void }) {
  const finished = item.status !== "open";
  return (
    <li className="flex items-start gap-3 py-3">
      <Checkbox checked={item.status === "done"} disabled={busy} onCheckedChange={onToggle} aria-label={item.status === "open" ? `Mark ${item.title} done` : `Reopen ${item.title}`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={finished ? "text-sm text-muted-foreground line-through" : "text-sm font-semibold text-foreground"}>{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.status === "done" && item.completedAt ? `Done ${formatPortalDate(item.completedAt)}${item.completedBy ? ` by ${item.completedBy}` : ""}` : `Due ${formatPortalDate(item.dueDate)}`}
          {" · "}{ownerLabel(item)}
        </p>
        {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
        {flags(item).length > 0 ? <p className="mt-0.5 text-xs font-semibold text-foreground">{flags(item).join(" · ")}</p> : null}
      </div>
      <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
    </li>
  );
}
