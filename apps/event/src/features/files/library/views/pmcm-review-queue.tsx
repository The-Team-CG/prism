"use client";

import { Eye } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { formatPortalDate } from "@prism/ui/format-date";
import { pmcmFileKind, type PmcmReviewEntry } from "../model/pmcm-file-library";
import type { PmcmFileLibraryViewModel } from "../view-models/use-pmcm-file-library-view-model";
import { PmcmFileKindIcon } from "./pmcm-file-kind-icon";
import { PmcmRejectForm } from "./pmcm-reject-form";

function ReviewRow({ entry, vm }: { entry: PmcmReviewEntry; vm: PmcmFileLibraryViewModel }) {
  const busy = vm.busy !== null;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Checkbox aria-label={`Select ${entry.fileName}`} checked={vm.selected.has(entry.documentId)} onCheckedChange={() => vm.toggleSelected(entry.documentId)} />
      <PmcmFileKindIcon kind={pmcmFileKind(entry.fileName)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => vm.openPreview(entry.objectId)}>
        <span className="block truncate text-sm font-semibold text-foreground">{entry.fileName}</span>
        <span className="block text-xs text-muted-foreground">For {entry.requirementLabel} · from {entry.sender} · {formatPortalDate(entry.uploadedAt)}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" aria-label={`Preview ${entry.fileName}`} onClick={() => vm.openPreview(entry.objectId)}><Eye className="size-4" /></Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => void vm.review(entry, "approve")}>Approve</Button>
        <PmcmRejectForm fileName={entry.fileName} disabled={busy} onReject={(reason) => void vm.review(entry, "reject", reason)} />
      </div>
    </li>
  );
}

/** Files waiting for PMCM's decision, oldest first, with preview, approve, reject and approve-several. */
export function PmcmReviewQueue({ vm }: { vm: PmcmFileLibraryViewModel }) {
  if (!vm.queue.length) return null;
  const allSelected = vm.selected.size === vm.queue.length;
  return (
    <section aria-label="Waiting for review" className="rounded-lg border border-attention/30 bg-attention-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Checkbox aria-label="Select every file waiting for review" checked={allSelected} onCheckedChange={vm.toggleAll} />
          <h3 className="text-sm font-semibold text-foreground">Waiting for review <span className="text-attention">{vm.queue.length}</span></h3>
        </div>
        {vm.selected.size ? (
          <Button type="button" size="sm" disabled={vm.busy !== null} onClick={() => void vm.approveSelected()}>Approve {vm.selected.size} selected</Button>
        ) : <p className="text-xs text-muted-foreground">Open a file to check it before you decide.</p>}
      </div>
      <ul className="mt-1 divide-y divide-border">
        {vm.queue.map((entry) => <ReviewRow key={entry.documentId} entry={entry} vm={vm} />)}
      </ul>
    </section>
  );
}
