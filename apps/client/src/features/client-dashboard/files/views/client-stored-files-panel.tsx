"use client";

import Link from "next/link";
import { useRef } from "react";
import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import type { PrismStoredObject } from "@prism/types";
import { useClientStoredFilesViewModel } from "../view-models/use-client-stored-files-view-model";
import {
  buildClientDocumentChecklist,
  clientRequirementReviewLabel,
  type ClientDocumentChecklistRow,
} from "../model/client-document-checklist";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { clientFileRequirementDestination, clientFileRequirementDetail } from "../model/client-file-requirement-copy";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

type FilesVm = ReturnType<typeof useClientStoredFilesViewModel>;

function displaySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayUsage(object: PrismStoredObject) {
  if (object.usage === "event_deliverable") return "Shared by PMCM";
  if (object.usage === "signed_conforme") return "Conforme";
  return "Your upload, not linked to a requirement";
}

function reviewTone(row: ClientDocumentChecklistRow) {
  if (row.requirement.validationStatus === "rejected" || row.requirement.overdue) return "text-danger";
  if (row.requirement.status === "approved" || row.requirement.status === "complete") return "text-success";
  return "text-muted-foreground";
}

function DownloadButton({ file, vm }: { file: PrismStoredObject; vm: FilesVm }) {
  if (file.lifecycleState !== "stored") return null;
  return (
    <button
      type="button"
      onClick={() => void vm.downloadFile(file.id)}
      disabled={vm.activeDownload !== null}
      aria-label={`Download ${file.originalFileName}`}
      className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {vm.activeDownload === file.id ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
    </button>
  );
}

function RequirementAction({ row, eventId, vm, onUpload }: { row: ClientDocumentChecklistRow; eventId: string; vm: FilesVm; onUpload: (key: string) => void }) {
  if (row.uploadable) {
    const replacing = Boolean(row.file) || row.requirement.validationStatus === "rejected";
    if (!row.needsClient && row.requirement.status === "approved") return null;
    return (
      <button
        type="button"
        onClick={() => onUpload(row.requirement.key)}
        disabled={vm.busy}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold disabled:opacity-60 ${row.needsClient ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
      >
        <Upload className="size-4" aria-hidden="true" />
        {replacing ? "Replace" : "Upload"}
        <span className="sr-only"> {row.requirement.label}</span>
      </button>
    );
  }
  if (["approved", "complete"].includes(row.requirement.status)) return null;
  const destination = clientFileRequirementDestination(row.requirement, eventId);
  if (destination.href === "#event-files") return null;
  return (
    <Link href={destination.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary hover:text-primary/80">
      {destination.label}
    </Link>
  );
}

function RequirementRow({ row, eventId, vm, onUpload }: { row: ClientDocumentChecklistRow; eventId: string; vm: FilesVm; onUpload: (key: string) => void }) {
  const { requirement, file } = row;
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{requirement.key === "client_feedback" ? "Event feedback" : requirement.label}</p>
        <p className={`mt-0.5 text-sm ${reviewTone(row)}`}>
          {clientRequirementReviewLabel(row)}
          <span className="text-muted-foreground"> · {fileRequirementDueSummary(requirement)}</span>
        </p>
        {file ? (
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-foreground">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 break-words">{file.originalFileName}</span>
          </p>
        ) : !row.uploadable ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{clientFileRequirementDetail(requirement)}</p>
        ) : null}
        {!row.uploadable && requirement.ownerRole !== "client" ? <p className="mt-1 text-xs text-muted-foreground">Provided by PMCM</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {file ? <DownloadButton file={file} vm={vm} /> : null}
        <RequirementAction row={row} eventId={eventId} vm={vm} onUpload={onUpload} />
      </div>
    </li>
  );
}

function OtherFiles({ files, vm, onUpload }: { files: PrismStoredObject[]; vm: FilesVm; onUpload: (key?: string) => void }) {
  return (
    <section aria-labelledby="client-other-files-title" className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="client-other-files-title" className="text-sm font-semibold text-foreground">Other files</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Files PMCM shared with you, and uploads not linked to a requirement.</p>
        </div>
        <button
          type="button"
          onClick={() => onUpload(undefined)}
          disabled={vm.busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-60"
        >
          <Upload className="size-4" aria-hidden="true" /> Send another file
        </button>
      </div>
      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No other files yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-3">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-foreground">{file.originalFileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {displayUsage(file)} · {displaySize(file.declaredByteSize)} · {file.lifecycleState === "stored" ? "Available" : file.lifecycleState}
                </p>
              </div>
              <DownloadButton file={file} vm={vm} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The event's document checklist: each requirement with its upload, review state, due date and the one
 * action it needs, then every other file. Uploading from a row links the file to that requirement.
 */
export function ClientStoredFilesPanel({ eventId }: { eventId?: string }) {
  const vm = useClientStoredFilesViewModel(eventId);
  const pendingKey = useRef<string | undefined>(undefined);
  if (!eventId) return null;

  const checklist = buildClientDocumentChecklist(vm.requirements, vm.files);
  const outstanding = checklist.rows.filter((row) => row.needsClient).length;
  const startUpload = (key?: string) => {
    pendingKey.current = key;
    vm.inputRef.current?.click();
  };

  return (
    <section id="event-files" aria-labelledby="client-documents-title" className="scroll-mt-6 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="client-documents-title" className="text-base font-semibold text-foreground">Documents for this event</h2>
        {checklist.rows.length > 0 ? (
          <p className={`text-sm tabular-nums ${outstanding > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {outstanding > 0 ? `${outstanding} still needed from you` : "Nothing needed from you"}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">PDF, Word, Excel, JPG or PNG, up to 25 MB. Uploading a file sends it to PMCM for review; it does not approve it.</p>
      <input
        ref={vm.inputRef}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="Choose a document to upload for this event"
        accept={ACCEPTED_FILES}
        onChange={(event) => void vm.uploadSelectedFile(event.currentTarget.files?.[0], pendingKey.current)}
        disabled={vm.busy}
      />
      {vm.busy ? <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Uploading…</p> : null}
      {vm.error ? <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{vm.error}</p> : null}
      {vm.notice ? <p role="status" className="mt-3 text-sm text-success">{vm.notice}</p> : null}

      {vm.loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Loading documents…</p>
      ) : (
        <>
          {checklist.rows.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">PMCM hasn&apos;t requested any documents for this event yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {checklist.rows.map((row) => <RequirementRow key={row.requirement.key} row={row} eventId={eventId} vm={vm} onUpload={startUpload} />)}
            </ul>
          )}
          <OtherFiles files={checklist.otherFiles} vm={vm} onUpload={startUpload} />
        </>
      )}
    </section>
  );
}
