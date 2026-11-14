"use client";

import { FileCheck2 } from "lucide-react";
import { useState } from "react";
import type { PrismFileRequirementItem } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { useFileRequirementsMatrixViewModel } from "../view-models/use-file-requirements-matrix-view-model";
import { useFileRequirementEditorViewModel } from "../view-models/use-file-requirement-editor-view-model";
import {
  FILE_HUB_HELP_COPY,
  fileRequirementCounts,
  fileRequirementMetadataLine,
  formatFileRequirementDate,
  sortFileRequirementItems,
} from "../model/file-requirements-matrix-rules";
import { FileRequirementEditorForm } from "./file-requirement-editor-form";
import { FileRequirementTemplateManager } from "./file-requirement-template-manager";
import { LoadingState } from "@prism/ui/components/loading-state";
import { useRequirementFileReview } from "../view-models/use-requirement-file-review";

export function FileRequirementsMatrixPanel({ eventId, suppliers = [] }: { eventId?: string; suppliers?: Array<{ supplierId: string; supplierName: string }> }) {
  const { matrix, status, error, reload, remindersBusy, reminderError, sendReminders } = useFileRequirementsMatrixViewModel(eventId);
  const editor = useFileRequirementEditorViewModel(eventId, reload);
  const review = useRequirementFileReview(eventId, reload);
  const counts = fileRequirementCounts(matrix);
  const items = sortFileRequirementItems(matrix?.items ?? []);
  const editable = status === "success" && Boolean(eventId);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  function renderRequirements() {
    return <>      {status === "error" ? (
        <div className="px-6 py-6">
          <Empty className="border-0 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileCheck2 /></EmptyMedia>
              <EmptyTitle>Unable to load file requirements</EmptyTitle>
              <EmptyDescription>{error ?? "Try again after selecting an event."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : status === "loading" || status === "idle" ? (
        <LoadingState label="Loading file requirements…" className="px-6 py-6" />
      ) : items.length === 0 ? (
        <div className="px-6 py-6">
          <Empty className="border-0 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileCheck2 /></EmptyMedia>
              <EmptyTitle>No visible file requirements</EmptyTitle>
              <EmptyDescription>Requirements appear after conforme, briefing, or supplier records exist.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <FileRequirementRow key={item.key} item={item} editable={editable} editor={editor} suppliers={suppliers} review={review} />
          ))}
        </div>
      )}
</>;
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">File requirements matrix</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{FILE_HUB_HELP_COPY}</p>
          <FileRequirementCountLine counts={counts} />
        </div>
        {editable && editor.target?.mode !== "create" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void sendReminders()} disabled={remindersBusy}>
              {remindersBusy ? "Queueing…" : "Send reminders"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setTemplatesOpen((open) => !open)}>Templates</Button>
            <Button type="button" variant="outline" size="sm" onClick={editor.startCreate}>
              Add requirement
            </Button>
          </div>
        ) : null}
      </div>
      {reminderError ? <p role="alert" className="border-b border-border px-6 py-2 text-xs text-danger">{reminderError}</p> : null}
      {review.error ? <p role="alert" className="border-b border-border px-6 py-2 text-xs text-destructive">{review.error}</p> : null}
      {templatesOpen && eventId ? <FileRequirementTemplateManager eventId={eventId} onClose={() => setTemplatesOpen(false)} onApplied={reload} /> : null}
      {editor.target?.mode === "create" ? (
        <div className="px-6 py-4">
          <FileRequirementEditorForm mode="create" suppliers={suppliers} busy={editor.busy} error={editor.saveError} onSave={editor.save} onCancel={editor.cancel} />
        </div>
      ) : null}
      {renderRequirements()}
    </section>
  );
}

function FileRequirementCountLine({ counts }: { counts: ReturnType<typeof fileRequirementCounts> }) {
  if (counts.total === 0) return null;
  return (
    <p className="mt-2 text-xs font-semibold text-muted-foreground">
      {counts.open} open of {counts.total} requirements
      {counts.overdue > 0 ? <span className="text-destructive"> · {counts.overdue} overdue</span> : null}
    </p>
  );
}

function SupplierFulfilmentList({ fulfilments, itemKey, review }: { fulfilments: NonNullable<PrismFileRequirementItem["supplierFulfilments"]>; itemKey: string; review: ReturnType<typeof useRequirementFileReview> }) {
  return (
    <ul className="mt-2 space-y-1">
      {fulfilments.map((fulfilment) => (
        <li key={fulfilment.supplierId} className="flex flex-wrap items-center gap-2 text-2xs">
          <span className="font-semibold text-foreground">{fulfilment.supplierName}</span>
          <StatusBadge status={fulfilment.status} />
          {fulfilment.overdue ? <span className="font-semibold text-destructive">Overdue</span> : null}
          {fulfilment.reviewReason ? <span>Rejected: {fulfilment.reviewReason}</span> : null}
          {fulfilment.uploadedObjectId ? <button type="button" className="rounded border border-border px-2 py-1" onClick={() => void review.download(fulfilment.uploadedObjectId!)}>Download file</button> : null}
          {(fulfilment.versions?.length ?? 0) > 1 ? <details><summary>Previous versions</summary><ul>{fulfilment.versions?.slice(1).map((version) => <li key={version.documentId}><button type="button" className="text-primary" onClick={() => void review.download(version.objectId)}>{version.fileName}</button> · {version.status}{version.reviewReason ? ` · ${version.reviewReason}` : ""}</li>)}</ul></details> : null}
          {fulfilment.status === "submitted" && fulfilment.uploadedAssetId ? <FileReviewForm itemKey={itemKey} documentId={fulfilment.uploadedAssetId} review={review} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** What PMCM can open and review on a requirement: each supplier's file, or the single owner's latest upload. */
function RequirementUploads({ item, review }: { item: PrismFileRequirementItem; review: ReturnType<typeof useRequirementFileReview> }) {
  if (item.supplierFulfilments) return item.supplierFulfilments.length ? <SupplierFulfilmentList fulfilments={item.supplierFulfilments} itemKey={item.key} review={review} /> : null;
  return item.origin === "custom" && item.uploadedObjectId ? <OwnerUploadReview item={item} review={review} /> : null;
}

/** The latest upload for a requirement the client (or another single owner) fulfils, with PMCM's approve or reject. */
function OwnerUploadReview({ item, review }: { item: PrismFileRequirementItem; review: ReturnType<typeof useRequirementFileReview> }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
      {item.reviewReason ? <span>Rejected: {item.reviewReason}</span> : null}
      <button type="button" className="rounded border border-border px-2 py-1" onClick={() => void review.download(item.uploadedObjectId!)}>Download file</button>
      {(item.versions?.length ?? 0) > 1 ? <details><summary>Previous versions</summary><ul>{item.versions?.slice(1).map((version) => <li key={version.documentId}><button type="button" className="text-primary" onClick={() => void review.download(version.objectId)}>{version.fileName}</button> · {version.status}{version.reviewReason ? ` · ${version.reviewReason}` : ""}</li>)}</ul></details> : null}
      {item.status === "submitted" && item.uploadedAssetId ? <FileReviewForm itemKey={item.key} documentId={item.uploadedAssetId} review={review} /> : null}
    </div>
  );
}

function FileReviewForm({ itemKey, documentId, review }: { itemKey: string; documentId: string; review: ReturnType<typeof useRequirementFileReview> }) {
  const [reason, setReason] = useState("");
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" disabled={review.busy} onClick={() => void review.review(itemKey, documentId, "approve", "")} className="rounded border border-border px-2 py-1">Approve</button>
    <input aria-label="Reason for rejection" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for rejection" className="rounded border border-border bg-background px-2 py-1" />
    <button type="button" disabled={review.busy || !reason.trim()} onClick={() => void review.review(itemKey, documentId, "reject", reason)} className="rounded border border-border px-2 py-1">Reject</button>
  </div>;
}

type FileRequirementEditor = ReturnType<typeof useFileRequirementEditorViewModel>;

function FileRequirementRow({ item, editable, editor, suppliers, review }: { item: PrismFileRequirementItem; editable: boolean; editor: FileRequirementEditor; suppliers: Array<{ supplierId: string; supplierName: string }>; review: ReturnType<typeof useRequirementFileReview> }) {
  const editing = editor.target?.mode === "edit" && editor.target.item.key === item.key;
  return (
    <div className="px-6 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{item.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          <p className="mt-1 text-2xs text-muted-foreground">
            {fileRequirementMetadataLine(item)}
          </p>
          <p className="mt-1 text-2xs font-semibold text-muted-foreground">
            {item.required ? "Required" : "Optional"}
            {item.dueDate ? ` · Due ${formatFileRequirementDate(item.dueDate)}` : ""}
            {item.overdue ? <span className="text-destructive"> · Overdue</span> : null}
          </p>
          {item.notes ? <p className="mt-1 text-2xs text-muted-foreground">PMCM note: {item.notes}</p> : null}
          <RequirementUploads item={item} review={review} />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          {editable && !editing ? (
            <button type="button" onClick={() => editor.startEdit(item)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">
              Edit
            </button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <div className="mt-3">
          <FileRequirementEditorForm mode="edit" item={item} suppliers={suppliers} busy={editor.busy} error={editor.saveError} onSave={editor.save} onCancel={editor.cancel} />
        </div>
      ) : null}
    </div>
  );
}
