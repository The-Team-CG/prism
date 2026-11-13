"use client";

import { Download, LoaderCircle, Search, Upload } from "lucide-react";
import { EVENT_FILE_CATEGORIES, type EventFileCategory, type PrismStoredObject } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatFileSize, type PmcmFileFilter, type PmcmFileTone, type PmcmLibraryFile } from "../model/pmcm-file-library";
import { usePmcmFileLibraryViewModel, type PmcmFileLibraryViewModel } from "../view-models/use-pmcm-file-library-view-model";
import { PmcmFileKindIcon } from "./pmcm-file-kind-icon";
import { PmcmFilePreviewSheet } from "./pmcm-file-preview-sheet";
import { PmcmReviewQueue } from "./pmcm-review-queue";

const FILTERS: ReadonlyArray<{ id: PmcmFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  { id: "review", label: "Waiting for review" },
  { id: "client", label: "From the client" },
  { id: "supplier", label: "From suppliers" },
  { id: "pmcm", label: "From PMCM" },
];

const TONE: Record<PmcmFileTone, string> = {
  attention: "text-attention",
  urgent: "text-destructive",
  done: "text-success",
  neutral: "text-muted-foreground",
};

const TABLE_COLUMNS = "md:grid-cols-[minmax(0,2.4fr)_1fr_0.8fr_0.6fr_1fr_auto]";

function UploadControls({ vm }: { vm: PmcmFileLibraryViewModel }) {
  const uploading = vm.busy === "upload";
  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}

function FileFilters({ vm }: { vm: PmcmFileLibraryViewModel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Show files" className="flex flex-wrap gap-1.5">
        {FILTERS.map((entry) => (
          <Button
            key={entry.id}
            type="button"
            size="sm"
            variant={vm.filter === entry.id ? "secondary" : "ghost"}
            aria-pressed={vm.filter === entry.id}
            onClick={() => vm.setFilter(entry.id)}
          >
            {entry.label}
            <span className="tabular-nums text-muted-foreground">{vm.counts[entry.id]}</span>
          </Button>
        ))}
      </div>
      <label className="relative block w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={vm.query} onChange={(event) => vm.setQuery(event.target.value)} placeholder="Search files" aria-label="Search this event's files" className="pl-8" />
      </label>
    </div>
  );
}

function FileRow({ file, vm }: { file: PmcmLibraryFile; vm: PmcmFileLibraryViewModel }) {
  return (
    <li className={`grid grid-cols-[1fr_auto] items-center gap-3 py-3 ${TABLE_COLUMNS}`}>
      <button type="button" className="flex min-w-0 items-center gap-3 text-left" aria-label={`Preview ${file.name}`} onClick={() => vm.openPreview(file.id)}>
        <PmcmFileKindIcon kind={file.kind} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{file.name}</span>
          {file.label ? <span className="block truncate text-xs text-muted-foreground">{file.label}</span> : null}
        </span>
      </button>
      <span className="hidden truncate text-sm text-muted-foreground md:block">{file.from}</span>
      <span className="hidden text-sm text-muted-foreground md:block">{formatPortalDate(file.addedAt)}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground md:block">{formatFileSize(file.size)}</span>
      <span className={`hidden text-sm font-medium md:block ${TONE[file.tone]}`}>{file.status}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={`Download ${file.name}`} disabled={vm.busy !== null} onClick={() => void vm.download(file.id)}>
        {vm.busy === `download:${file.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
      </Button>
    </li>
  );
}

function emptyMessage(vm: PmcmFileLibraryViewModel) {
  if (vm.query || vm.filter !== "all") return "No files match.";
  return "No files yet. Share one with the client, or wait for the client and suppliers to send theirs.";
}

function FileTable({ vm }: { vm: PmcmFileLibraryViewModel }) {
  if (vm.loading) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading files…</p>;
  if (!vm.files.length) return <p className="py-6 text-sm text-muted-foreground">{emptyMessage(vm)}</p>;
  return (
    <div>
      <div className={`hidden gap-3 border-b border-border pb-2 text-xs font-medium text-muted-foreground md:grid ${TABLE_COLUMNS}`}>
        <span>Name</span>
        <span>From</span>
        <span>Added</span>
        <span>Size</span>
        <span>Status</span>
        <span className="w-9" />
      </div>
      <ul className="divide-y divide-border">
        {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} />)}
      </ul>
    </div>
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
export function PmcmFileLibraryView({ eventId }: { eventId: string }) {
  const vm = usePmcmFileLibraryViewModel(eventId);
  return (
    <section aria-label="Event file library" className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Library</h2>
          <p className="mt-1 text-xs text-muted-foreground">Everything on this event. Files you share here are visible to the client.</p>
        </div>
        <UploadControls vm={vm} />
      </div>
      <Messages vm={vm} />
      <PmcmReviewQueue vm={vm} />
      <FileFilters vm={vm} />
      <FileTable vm={vm} />
      <UnfinishedUploads uploads={vm.unfinished} />
      <PmcmFilePreviewSheet vm={vm} />
    </section>
  );
}
