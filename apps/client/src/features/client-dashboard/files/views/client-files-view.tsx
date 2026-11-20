"use client";

import { CheckCircle2, FileArchive, FileText, LoaderCircle, Upload } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import {
  FileDownloadButton,
  FileEventHeading,
  FileFilterBar,
  FileKindIcon,
  FileLibraryPanel,
  FileNeededList,
  FileNeededRow,
  FileTable,
  FileTableRow,
  formatFileSize,
  useFileDrop,
  useFileEventChoice,
} from "@prism/ui/file-library";
import { LoadingState } from "@prism/ui/components/loading-state";
import { formatPortalDate } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { formatStatusLabel } from "../../workspace/shared";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { clientRequirementReviewLabel, type ClientDocumentChecklistRow } from "../model/client-document-checklist";
import { CLIENT_FILE_CATEGORIES, type ClientFileFilter, type ClientLibraryFile } from "../model/client-file-library";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { useClientFileEvents, useClientFileLibraryViewModel, type ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFileEventCards } from "./client-file-event-cards";
import { ClientFilePreviewSheet } from "./client-file-preview-sheet";
import { ClientFileReuseDialog } from "./client-file-reuse-dialog";
import { clientEventDateLabel } from "../../workspace/model/client-dashboard-view-rules";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

const FILTERS: ReadonlyArray<{ id: ClientFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  ...CLIENT_FILE_CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
  { id: "other", label: "Other" },
];

function eventMeta(event: PrismEvent) {
  return [clientEventDateLabel(event), event.venue || "Venue to be confirmed", formatStatusLabel(event.status)].join(" · ");
}

function NeededRowActions({ row, vm }: { row: ClientDocumentChecklistRow; vm: ClientFileLibraryViewModel }) {
  const { requirement } = row;
  const replacing = Boolean(row.file) || requirement.validationStatus === "rejected";
  return (
    <>
      {vm.events.length > 1 ? (
        <Button type="button" size="sm" variant="outline" onClick={() => vm.openReuse(requirement.key, requirement.label)} disabled={vm.busy}>
          Use existing<span className="sr-only"> file for {requirement.label}</span>
        </Button>
      ) : null}
      <Button type="button" size="sm" onClick={() => vm.startUpload(requirement.key)} disabled={vm.busy}>
        <Upload className="size-4" aria-hidden="true" />
        {replacing ? "Replace" : "Upload"}
        <span className="sr-only"> {requirement.label}</span>
      </Button>
    </>
  );
}

function NeededRow({ row, vm }: { row: ClientDocumentChecklistRow; vm: ClientFileLibraryViewModel }) {
  const { requirement } = row;
  const drop = useFileDrop((files) => void vm.uploadFiles(files, requirement.key), vm.canUpload && !vm.busy);
  return (
    <FileNeededRow
      label={requirement.label}
      detail={`${clientRequirementReviewLabel(row)} · ${fileRequirementDueSummary(requirement)}`}
      urgent={requirement.validationStatus === "rejected" || Boolean(requirement.overdue)}
      note={requirement.validationStatus === "rejected" ? requirement.reviewReason : undefined}
      drop={drop}
      actions={vm.canUpload ? <NeededRowActions row={row} vm={vm} /> : undefined}
    />
  );
}

function NeededSection({ vm }: { vm: ClientFileLibraryViewModel }) {
  if (vm.neededLoading) return null;
  if (vm.needed.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-sm text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Nothing needed from you for this event.
      </p>
    );
  }
  return (
    <FileNeededList id="client-files-needed" count={vm.needed.length}>
      {vm.needed.map((row) => <NeededRow key={row.requirement.key} row={row} vm={vm} />)}
    </FileNeededList>
  );
}

function FileRow({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  const action = file.objectId ? (
    <FileDownloadButton label={`Download ${file.name}`} busy={vm.activeDownload === file.objectId} disabled={vm.activeDownload !== null} onClick={() => void vm.downloadFile(file.objectId!)} />
  ) : null;
  return (
    <FileTableRow
      kind={file.kind}
      name={file.name}
      detail={file.requirementLabel ? `For ${file.requirementLabel}` : null}
      isNew={file.isNew}
      from={file.addedBy}
      addedAt={file.addedAt}
      size={file.size}
      status={{ label: file.status, tone: file.tone, expiresAt: file.expiresAt, title: file.reviewReason }}
      onOpen={() => vm.openPreview(file.id)}
      action={action}
    />
  );
}

/** Matches for an all-events search; opening one switches to its event and previews it. */
function AccountResults({ vm }: { vm: ClientFileLibraryViewModel }) {
  if (vm.accountLoading) return <LoadingState label="Searching all your events…" className="px-4 py-4" />;
  if (vm.accountResults.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No files in any of your events match your search.</p>;
  return (
    <ul className="divide-y divide-border">
      {vm.accountResults.map((file) => (
        <li key={`${file.eventId}:${file.id}`}>
          <button type="button" onClick={() => vm.openSearchResult(file)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-raised">
            <FileKindIcon kind={file.kind} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{[file.eventName, file.addedBy, file.addedAt ? formatPortalDate(file.addedAt) : null].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="hidden shrink-0 text-sm text-primary sm:inline">Open</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DownloadAllButton({ vm }: { vm: ClientFileLibraryViewModel }) {
  if (vm.downloadableCount === 0) return null;
  const zipping = vm.archiving;
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void vm.downloadAll()} disabled={zipping !== null}>
      {zipping ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileArchive className="size-4" aria-hidden="true" />}
      {zipping ? `Zipping ${Math.min(zipping.done + 1, zipping.total)} of ${zipping.total}` : "Download all"}
    </Button>
  );
}

function SearchScope({ vm }: { vm: ClientFileLibraryViewModel }) {
  if (!vm.canSearchAll) return null;
  return (
    <div role="group" aria-label="Search in" className="inline-flex rounded-md border border-border p-0.5 text-xs">
      {([false, true] as const).map((all) => (
        <button
          key={String(all)}
          type="button"
          aria-pressed={vm.searchAll === all}
          onClick={() => vm.setSearchAll(all)}
          className={cn("rounded px-2 py-1", vm.searchAll === all ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {all ? "All events" : "This event"}
        </button>
      ))}
    </div>
  );
}

/** Asks before zipping a very large set in the browser, naming the biggest files to download on their own. */
function ArchiveWarning({ vm }: { vm: ClientFileLibraryViewModel }) {
  const warning = vm.archiveWarning;
  if (!warning) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-border bg-attention-soft px-4 py-3 text-sm">
      <p className="min-w-0 flex-1 text-foreground">
        These files total {formatFileSize(warning.totalBytes)}. Building one ZIP that large in the browser can be slow or fail;
        you can download the largest ({warning.largest.join(", ")}) on their own instead.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={vm.dismissArchiveWarning}>Cancel</Button>
        <Button type="button" size="sm" onClick={() => void vm.downloadAll(true)}>Zip anyway</Button>
      </div>
    </div>
  );
}

function FileFilters({ vm }: { vm: ClientFileLibraryViewModel }) {
  const filters = FILTERS.filter((entry) => entry.id !== "other" || vm.counts.other > 0).map((entry) => ({ ...entry, count: vm.counts[entry.id] }));
  return (
    <FileFilterBar
      label="File categories"
      filters={filters}
      value={vm.filter}
      onChange={vm.setFilter}
      query={vm.query}
      onQuery={vm.setQuery}
      searchLabel={vm.searchAll ? "Search all your files" : "Search this event's files"}
      searchPlaceholder={vm.searchAll ? "Search all your files" : "Search files"}
    >
      <DownloadAllButton vm={vm} />
      <SearchScope vm={vm} />
    </FileFilterBar>
  );
}

function emptyFilesMessage(vm: ClientFileLibraryViewModel) {
  if (vm.query) return "No files match your search.";
  if (vm.hasFiles) return `No ${FILTERS.find((entry) => entry.id === vm.filter)?.label.toLowerCase() ?? "files"} for this event yet.`;
  return vm.canUpload ? "No files for this event yet. Drop files here or use Upload; files PMCM shares appear here too." : "No files were kept for this event.";
}

function EventFileList({ vm }: { vm: ClientFileLibraryViewModel }) {
  if (vm.filesLoading) return <LoadingState label="Loading files…" className="px-4 py-4" />;
  if (vm.files.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyFilesMessage(vm)}</p>;
  return (
    <>
      {vm.newCount > 0 ? <p className="border-b border-border px-4 py-2 text-xs font-medium text-primary">{vm.newCount} new since your last visit</p> : null}
      <FileTable fromLabel="Added by" sort={vm.sort} onSort={vm.toggleSort}>
        {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} />)}
      </FileTable>
    </>
  );
}

/** Upload progress, the latest error, and the latest confirmation. */
function UploadStatus({ vm }: { vm: ClientFileLibraryViewModel }) {
  const error = vm.error ?? vm.loadError;
  return (
    <>
      {vm.progress ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {vm.progress.total > 1 ? `Uploading ${vm.progress.done + 1} of ${vm.progress.total}: ` : "Uploading "}
          <span className="truncate text-foreground">{vm.progress.current}</span>
        </p>
      ) : null}
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
    </>
  );
}

function UploadButton({ vm }: { vm: ClientFileLibraryViewModel }) {
  return (
    <Button type="button" onClick={() => vm.startUpload(undefined)} disabled={vm.busy}>
      {vm.busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
      {vm.busy ? "Uploading…" : "Upload"}
    </Button>
  );
}

/**
 * One event's files for the client, in the Library panel every portal shares: what PMCM still needs from them, then
 * every file on fixed shelves in one table. Opening a file previews it with its review state and versions; files can
 * be dropped on a needed item or on the table. `openEvent` lets a search across every event open a match elsewhere.
 */
export function ClientEventFileLibrary({ eventId, openEvent }: { eventId: string; openEvent?: (eventId: string) => void }) {
  const vm = useClientFileLibraryViewModel(eventId, openEvent);
  const drop = useFileDrop((files) => void vm.uploadFiles(files), vm.canUpload && !vm.busy);
  const event = vm.event;
  if (!event) return <ClientListEmpty icon={FileText} title="No files for this event" description="This event isn't one of yours, or it is no longer available." />;
  const searchingAll = vm.searchAll && vm.query.trim().length > 0;
  return (
    <>
      <FileLibraryPanel
        description={vm.canUpload ? "Everything on this event. Files you upload go to PMCM for review." : "Everything kept from this event."}
        actions={vm.canUpload ? <UploadButton vm={vm} /> : undefined}
        drop={drop}
        files={(
          <>
            <FileFilters vm={vm} />
            <ArchiveWarning vm={vm} />
            {searchingAll ? <AccountResults vm={vm} /> : <EventFileList vm={vm} />}
          </>
        )}
        footer={vm.canUpload ? <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG or PNG, up to 25 MB each. Uploading sends a file to PMCM for review; it doesn&apos;t approve it.</p> : undefined}
      >
        <input
          ref={vm.inputRef}
          className="sr-only"
          type="file"
          multiple
          tabIndex={-1}
          aria-label={`Choose files to upload for ${event.eventName}`}
          accept={ACCEPTED_FILES}
          onChange={(change) => vm.uploadPicked(change.currentTarget.files)}
          disabled={vm.busy}
        />
        <UploadStatus vm={vm} />
        {vm.canUpload ? <NeededSection vm={vm} /> : null}
      </FileLibraryPanel>
      <ClientFilePreviewSheet vm={vm} eventId={event.id} />
      <ClientFileReuseDialog vm={vm} />
    </>
  );
}

/**
 * The client's Files, drawn after PMCM's: every event as a card saying how many requested files are in, then the
 * chosen one's library. A client with one event goes straight to its library.
 */
export function ClientFilesView() {
  const events = useClientFileEvents();
  const { eventId, choose } = useFileEventChoice();
  if (events.length === 0) {
    return <ClientListEmpty icon={FileText} title="No event files yet" description="Files appear here once your event workspace is open." />;
  }
  const chosen = events.find((event) => event.id === eventId) ?? (events.length === 1 ? events[0] : undefined);
  if (!chosen) return <ClientFileEventCards events={events} onOpen={choose} />;
  return (
    <div className="grid gap-4">
      {events.length > 1 ? (
        <FileEventHeading title={chosen.eventName} meta={eventMeta(chosen)} onBack={() => choose(null)} />
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-foreground">{chosen.eventName}</h2>
          <p className="text-sm text-muted-foreground">{eventMeta(chosen)}</p>
        </div>
      )}
      <ClientEventFileLibrary eventId={chosen.id} openEvent={choose} />
    </div>
  );
}
