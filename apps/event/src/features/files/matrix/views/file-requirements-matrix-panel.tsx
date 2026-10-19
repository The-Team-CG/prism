"use client";

import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { useFileRequirementsMatrixViewModel } from "../view-models/use-file-requirements-matrix-view-model";
import { useFileRequirementEditorViewModel } from "../view-models/use-file-requirement-editor-view-model";
import {
  FILE_HUB_HELP_COPY,
  fileRequirementCounts,
  formatFileRequirementDate,
  sortFileRequirementItems,
} from "../model/file-requirements-matrix-rules";
import { FileRequirementEditorForm } from "./file-requirement-editor-form";

export function FileRequirementsMatrixPanel({ eventId }: { eventId?: string }) {
  const { matrix, status, error, reload } = useFileRequirementsMatrixViewModel(eventId);
  const editor = useFileRequirementEditorViewModel(eventId, reload);
  const counts = fileRequirementCounts(matrix);
  const items = sortFileRequirementItems(matrix?.items ?? []);
  const editable = status === "success" && Boolean(eventId);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">File requirements matrix</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{FILE_HUB_HELP_COPY}</p>
          {counts.total > 0 ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {counts.open} open of {counts.total} requirements
              {counts.overdue > 0 ? <span className="text-destructive"> · {counts.overdue} overdue</span> : null}
            </p>
          ) : null}
        </div>
        {editable && editor.target?.mode !== "create" ? (
          <button type="button" onClick={editor.startCreate} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">
            Add requirement
          </button>
        ) : null}
      </div>
      {editor.target?.mode === "create" ? (
        <div className="px-6 py-4">
          <FileRequirementEditorForm mode="create" busy={editor.busy} error={editor.saveError} onSave={editor.save} onCancel={editor.cancel} />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="Unable to load file requirements" description={error ?? "Try again after selecting an event."} />
        </div>
      ) : status === "loading" || status === "idle" ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">Loading file requirements…</p>
      ) : items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="No visible file requirements" description="Requirements appear after conforme, briefing, or supplier records exist." />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="px-6 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Owner {humanizeToken(item.ownerRole)} · Visible to {item.visibleToRoles.map(humanizeToken).join(", ")} · {item.sourceWorkflow}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {item.required ? "Required" : "Optional"}
                    {item.dueDate ? ` · Due ${formatFileRequirementDate(item.dueDate)}` : ""}
                    {item.overdue ? <span className="text-destructive"> · Overdue</span> : null}
                  </p>
                  {item.notes ? <p className="mt-1 text-[11px] text-muted-foreground">PMCM note: {item.notes}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} label={humanizeToken(item.status)} />
                  {editable && !(editor.target?.mode === "edit" && editor.target.item.key === item.key) ? (
                    <button type="button" onClick={() => editor.startEdit(item)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
              {editor.target?.mode === "edit" && editor.target.item.key === item.key ? (
                <div className="mt-3">
                  <FileRequirementEditorForm mode="edit" item={item} busy={editor.busy} error={editor.saveError} onSave={editor.save} onCancel={editor.cancel} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
