"use client";

import Link from "next/link";
import { CheckCircle2, Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  FILE_TONE,
  FileDetail,
  FileDownloadButton,
  FileFilterBar,
  FileNeededList,
  FileNeededRow,
  FilePreviewFrame,
  FilePreviewSheet,
  FileReviewNote,
  FileTable,
  FileTableRow,
  FileValidUntil,
  useFileDrop,
} from "@prism/ui/file-library";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismPageColumn } from "@prism/ui/page-blocks";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatDate } from "../../model/supplier-workspace-rules";
import { supplierBookingHref } from "../../model/supplier-next-step";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import type { SupplierFileFilter, SupplierLibraryFile, SupplierNeededFile } from "../../model/supplier-file-library";
import { useSupplierFileLibraryViewModel, useSupplierFilePreview, type SupplierFileLibraryViewModel } from "../../view-models/use-supplier-file-library-view-model";

const FILTERS: ReadonlyArray<{ id: SupplierFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  { id: "booking", label: "Booking documents" },
  { id: "contract", label: "Contracts" },
  { id: "certification", label: "Certifications" },
];

function neededDetail(item: SupplierNeededFile) {
  const due = item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date";
  return [item.eventName, due, item.overdue ? "Overdue" : null].filter(Boolean).join(" · ");
}

/** Sends a file for a requirement (or a newer one for a file PMCM has not approved yet). */
function UploadButton({ vm, eventId, requirementKey, label, ariaLabel, onPicked }: {
  vm: SupplierFileLibraryViewModel;
  eventId: string;
  requirementKey: string;
  label: string;
  ariaLabel: string;
  onPicked?: () => void;
}) {
  const uploading = vm.uploading === `${eventId}:${requirementKey}`;
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
      {uploading ? "Uploading" : label}
      <input
        type="file"
        className="sr-only"
        aria-label={ariaLabel}
        disabled={vm.uploading !== null}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          onPicked?.();
          void vm.upload(eventId, requirementKey, file);
        }}
      />
    </label>
  );
}

function NeededRow({ item, vm }: { item: SupplierNeededFile; vm: SupplierFileLibraryViewModel }) {
  const droppable = !item.bookingRequestId && vm.uploading === null;
  const drop = useFileDrop((files) => { if (files[0]) void vm.upload(item.eventId, item.key, files[0]); }, droppable);
  const action = item.bookingRequestId
    ? <Button asChild size="sm" variant="outline"><Link href={supplierBookingHref(item.bookingRequestId)}>Open booking</Link></Button>
    : <UploadButton vm={vm} eventId={item.eventId} requirementKey={item.key} label={item.replacing ? "Replace" : "Upload"} ariaLabel={`Upload ${item.label} for ${item.eventName}`} />;
  return (
    <FileNeededRow
      label={item.label}
      detail={neededDetail(item)}
      urgent={item.overdue || Boolean(item.reviewReason)}
      note={item.reviewReason}
      drop={drop}
      actions={action}
    />
  );
}

function NeededSection({ vm }: { vm: SupplierFileLibraryViewModel }) {
  if (vm.status === "loading") return <LoadingState label="Loading what PMCM needs from you…" />;
  const error = vm.error ?? vm.saveError;
  return (
    <>
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
      {vm.needed.length === 0 ? (
        <p className="flex items-center gap-2 px-1 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Nothing needed from you right now. PMCM will ask here when a booking needs a file.
        </p>
      ) : (
        <FileNeededList id="supplier-files-needed">
          {vm.needed.map((item) => <NeededRow key={`${item.eventId}:${item.key}`} item={item} vm={vm} />)}
        </FileNeededList>
      )}
    </>
  );
}

function FileRow({ file, vm, onDownloadObject }: { file: SupplierLibraryFile; vm: SupplierFileLibraryViewModel; onDownloadObject: (objectId: string) => void }) {
  const objectId = file.objectId;
  return (
    <FileTableRow
      kind={file.kind}
      name={file.name}
      detail={file.context}
      from={file.group === "certification" ? "PMCM" : "You"}
      addedAt={file.addedAt}
      size={file.size}
      status={{ label: file.status, tone: file.tone, expiresAt: file.expiresAt, title: file.reviewReason }}
      onOpen={() => vm.openPreview(file.id)}
      action={objectId ? <FileDownloadButton label={`Download ${file.name}`} onClick={() => onDownloadObject(objectId)} /> : null}
    />
  );
}

function FilesSection({ vm, onDownloadObject }: { vm: SupplierFileLibraryViewModel; onDownloadObject: (objectId: string) => void }) {
  return (
    <Card role="region" aria-label="Your files" className="gap-0 overflow-hidden py-0">
      <FileFilterBar
        label="Show files"
        filters={FILTERS.map((entry) => ({ ...entry, count: vm.counts[entry.id] }))}
        value={vm.filter}
        onChange={vm.setFilter}
        query={vm.query}
        onQuery={vm.setQuery}
        searchLabel="Search your files"
      />
      {vm.files.length === 0 ? (
        <div className="px-4 py-4"><PrismEmptyLine icon={FileText}>{vm.query || vm.filter !== "all" ? "No files match." : "No files yet. Files you send PMCM will be kept here."}</PrismEmptyLine></div>
      ) : (
        <FileTable>
          {vm.files.map((file) => <FileRow key={`${file.group}:${file.id}`} file={file} vm={vm} onDownloadObject={onDownloadObject} />)}
        </FileTable>
      )}
    </Card>
  );
}

function PreviewFrame({ file, session }: { file: SupplierLibraryFile; session: PrismAuthenticatedSession }) {
  const preview = useSupplierFilePreview(session, file);
  const fallback = file.objectId ? "This file type can't be shown here. Download it to open it." : "PMCM keeps this file on your supplier record.";
  return <FilePreviewFrame state={preview} name={file.name} kind={file.kind} fallback={fallback} />;
}

function PreviewActions({ file, vm, onDownloadObject }: { file: SupplierLibraryFile; vm: SupplierFileLibraryViewModel; onDownloadObject: (objectId: string) => void }) {
  const objectId = file.objectId;
  const target = file.replaces;
  if (!objectId) return null;
  return (
    <>
      <Button type="button" onClick={() => onDownloadObject(objectId)}><Download className="size-4" />Download</Button>
      {target ? (
        <UploadButton vm={vm} eventId={target.eventId} requirementKey={target.key} label="Send a newer file" ariaLabel={`Send a newer file for ${target.label}`} onPicked={vm.closePreview} />
      ) : null}
    </>
  );
}

/** A file opened from the library, in the panel every portal shares. */
function PreviewSheet({ vm, session, onDownloadObject }: { vm: SupplierFileLibraryViewModel; session: PrismAuthenticatedSession; onDownloadObject: (objectId: string) => void }) {
  const file = vm.preview;
  if (!file) return <FilePreviewSheet open={false} onClose={vm.closePreview} kind="other" name="" tall={false} frame={null} />;
  return (
    <FilePreviewSheet
      open
      onClose={vm.closePreview}
      kind={file.kind}
      name={file.name}
      meta={[file.context, formatPortalDate(file.addedAt)].filter(Boolean).join(" · ")}
      tall={Boolean(file.objectId) && (file.kind === "pdf" || file.kind === "image")}
      frame={<PreviewFrame key={file.id} file={file} session={session} />}
      footer={<PreviewActions file={file} vm={vm} onDownloadObject={onDownloadObject} />}
    >
      <FileReviewNote reason={file.reviewReason} />
      <dl className="divide-y divide-border">
        <FileDetail label="Status"><span className={FILE_TONE[file.tone]}>{file.status}</span></FileDetail>
        <FileValidUntil
          key={`${file.id}:${file.expiresAt ?? ""}`}
          fileName={file.name}
          expiresAt={file.expiresAt}
          editable={Boolean(file.datable && file.objectId)}
          busy={vm.saving}
          onSave={(value) => void vm.setExpiry(file, value)}
        />
      </dl>
    </FilePreviewSheet>
  );
}

/** The supplier's files: what PMCM still needs first, then everything they have sent and what PMCM keeps on file. */
export function FilesPage({
  workspace,
  session,
  workflowWorkspace,
  readinessBoard,
  onDownloadObject,
}: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  readinessBoard: PrismSupplierReadinessBoard | null;
  onDownloadObject: (objectId: string) => void;
}) {
  const vm = useSupplierFileLibraryViewModel({ workspace, session, workflowWorkspace, readinessBoard });
  return (
    <PrismPageColumn>
      <NeededSection vm={vm} />
      <FilesSection vm={vm} onDownloadObject={onDownloadObject} />
      <PreviewSheet vm={vm} session={session} onDownloadObject={onDownloadObject} />
    </PrismPageColumn>
  );
}
