"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { EVENT_FILE_CATEGORIES, type EventFileCategory, type PrismStoredObject } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { FileDownloadButton, FileFilterBar, FileLibraryPanel, FileTable as SharedFileTable, FileTableRow } from "@prism/ui/file-library";
import type { PmcmFileFilter, PmcmLibraryFile } from "../model/pmcm-file-library";
import { usePmcmFileLibraryViewModel, type PmcmFileLibraryViewModel } from "../view-models/use-pmcm-file-library-view-model";
import { PmcmFilePreviewSheet } from "./pmcm-file-preview-sheet";
import { PmcmReviewQueue } from "./pmcm-review-queue";

const FILTERS: ReadonlyArray<{ id: PmcmFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  { id: "review", label: "Waiting for review" },
  { id: "client", label: "From the client" },
  { id: "supplier", label: "From suppliers" },
  { id: "pmcm", label: "From PMCM" },
];

function UploadControls({ vm }: { vm: PmcmFileLibraryViewModel }) {
  const uploading = vm.busy === "upload";
  return (
    <>
      <Select value={vm.category} onValueChange={(next) => vm.setCategory(next as EventFileCategory)} disabled={uploading}>
        <SelectTrigger aria-label="Type of file to share" className="w-52 bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(EVENT_FILE_CATEGORIES) as EventFileCategory[]).map((key) => (
            <SelectItem key={key} value={key}>{EVENT_FILE_CATEGORIES[key]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        ref={vm.inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4,.mov"
        onChange={(event) => void vm.upload(event.currentTarget.files?.[0])}
        disabled={uploading}
      />
      <Button type="button" onClick={() => vm.inputRef.current?.click()} disabled={uploading}>
        {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading" : "Share a file"}
      </Button>
    </>
  );
}

function FileFilters({ vm }: { vm: PmcmFileLibraryViewModel }) {
  return (
    <FileFilterBar
      label="Show files"
      filters={FILTERS.map((entry) => ({ ...entry, count: vm.counts[entry.id] }))}
      value={vm.filter}
      onChange={vm.setFilter}
      query={vm.query}
      onQuery={vm.setQuery}
      searchLabel="Search this event's files"
    />
  );
}

function FileRow({ file, vm }: { file: PmcmLibraryFile; vm: PmcmFileLibraryViewModel }) {
  return (
    <FileTableRow
      kind={file.kind}
      name={file.name}
      detail={file.label}
      from={file.from}
      addedAt={file.addedAt}
      size={file.size}
      status={{ label: file.status, tone: file.tone, expiresAt: file.expiresAt }}
      onOpen={() => vm.openPreview(file.id)}
      action={<FileDownloadButton label={`Download ${file.name}`} busy={vm.busy === `download:${file.id}`} disabled={vm.busy !== null} onClick={() => void vm.download(file.id)} />}
    />
  );
}

function emptyMessage(vm: PmcmFileLibraryViewModel) {
  if (vm.query || vm.filter !== "all") return "No files match.";
  return "No files yet. Share one with the client, or wait for the client and suppliers to send theirs.";
}

function FileTable({ vm }: { vm: PmcmFileLibraryViewModel }) {
  if (vm.loading) return <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Loading files…</p>;
  if (!vm.files.length) return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage(vm)}</p>;
  return (
    <SharedFileTable>
      {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} />)}
    </SharedFileTable>
  );
}

function unfinishedState(upload: PrismStoredObject) {
  if (upload.lifecycleState !== "failed") return "Not finished";
  return upload.failureReason ? `Failed: ${upload.failureReason}` : "Failed";
}

/** Uploads that never finished stay out of the library; PMCM can still see them and why they failed. */
function UnfinishedUploads({ uploads }: { uploads: PrismStoredObject[] }) {
  if (!uploads.length) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">{uploads.length} {uploads.length === 1 ? "upload" : "uploads"} didn&apos;t finish</summary>
      <ul className="mt-2 space-y-1">
        {uploads.map((upload) => <li key={upload.id}>{upload.originalFileName} · {unfinishedState(upload)}</li>)}
      </ul>
    </details>
  );
}

function Messages({ vm }: { vm: PmcmFileLibraryViewModel }) {
  const problem = vm.loadError ?? vm.error;
  return (
    <>
      {problem ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p> : null}
      {vm.notice ? <p role="status" className="text-sm text-muted-foreground">{vm.notice}</p> : null}
    </>
  );
}

/** One event's files for PMCM: what to review first, then every file from the client, suppliers and PMCM. */
export function PmcmFileLibraryView({ eventId, coverObjectId = null, onCoverChange }: { eventId: string; coverObjectId?: string | null; onCoverChange?: () => void }) {
  const vm = usePmcmFileLibraryViewModel(eventId, coverObjectId, onCoverChange);
  return (
    <>
      <FileLibraryPanel
        description="Everything on this event. Files you share here are visible to the client."
        actions={<UploadControls vm={vm} />}
        files={<><FileFilters vm={vm} /><FileTable vm={vm} /></>}
        footer={vm.unfinished.length ? <UnfinishedUploads uploads={vm.unfinished} /> : undefined}
      >
        <Messages vm={vm} />
        <PmcmReviewQueue vm={vm} />
      </FileLibraryPanel>
      <PmcmFilePreviewSheet vm={vm} />
    </>
  );
}
