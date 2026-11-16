"use client";

import Link from "next/link";
import { CheckCircle2, FileArchive, FileText, LoaderCircle, Upload } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { useResource } from "@prism/portal-query";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { FileDownloadButton, FileFilterBar, FileKindIcon, FileNeededList, FileNeededRow, FileTable, FileTableRow, formatFileSize, useFileDrop } from "@prism/ui/file-library";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDate } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { clientEventFileRequirements } from "../data/client-file-library-resources";
import { buildClientDocumentChecklist, clientRequirementReviewLabel, type ClientDocumentChecklistRow } from "../model/client-document-checklist";
import { CLIENT_FILE_CATEGORIES, type ClientFileFilter, type ClientLibraryFile } from "../model/client-file-library";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { useClientFileLibraryViewModel, type ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFilePreviewSheet } from "./client-file-preview-sheet";
import { ClientFileReuseDialog } from "./client-file-reuse-dialog";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

const FILTERS: ReadonlyArray<{ id: ClientFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  ...CLIENT_FILE_CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
  { id: "other", label: "Other" },
];

function eventMeta(event: PrismEvent) {
  return [formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed", formatStatusLabel(event.status)].join(" · ");
}

/** What an upcoming event still needs from the client, read from its requirements; nothing for past events. */
function EventNeedsCount({ eventId }: { eventId: string }) {
  const requirements = useResource(clientEventFileRequirements, eventId);
  if (requirements.status !== "ready") return null;
  const rows = buildClientDocumentChecklist(requirements.data.items, []).rows.filter((row) => row.needsClient);
  if (rows.length === 0) return null;
  const urgent = rows.some((row) => row.requirement.overdue || row.requirement.validationStatus === "rejected");
  return (
    <span className={cn("shrink-0 text-xs font-medium tabular-nums", urgent ? "text-danger" : "text-attention")} title={`${rows.length} needed from you`}>
      {rows.length}
      <span className="sr-only"> needed from you</span>
    </span>
  );
}

function EventRail({ vm }: { vm: ClientFileLibraryViewModel }) {
  const group = (label: string, events: PrismEvent[], past: boolean) =>
    events.length === 0 ? null : (
      <div>
        <h2 className="px-2 pb-1 text-xs text-muted-foreground">{label}</h2>
        <ul className="space-y-0.5">
          {events.map((event) => {
            const active = event.id === vm.event?.id;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => vm.chooseEvent(event.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted", active && "bg-muted")}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm text-foreground", active && "font-semibold")}>{event.eventName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{formatPortalDate(event.eventDate)}</span>
                  </span>
                  {past ? null : <EventNeedsCount eventId={event.id} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <Card aria-label="Events" role="navigation" className="hidden gap-4 p-2 py-3 lg:sticky lg:top-4 lg:flex">
      {group("Upcoming", vm.upcomingEvents, false)}
      {group("Past", vm.pastEvents, true)}
    </Card>
  );
}

function MobileEventPicker({ vm }: { vm: ClientFileLibraryViewModel }) {
  return (
    <div className="lg:hidden">
      <Select value={vm.event?.id} onValueChange={vm.chooseEvent}>
        <SelectTrigger aria-label="Event" className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {vm.upcomingEvents.length ? (
            <SelectGroup>
              <SelectLabel>Upcoming</SelectLabel>
              {vm.upcomingEvents.map((event) => <SelectItem key={event.id} value={event.id}>{event.eventName}</SelectItem>)}
            </SelectGroup>
          ) : null}
          {vm.pastEvents.length ? (
            <SelectGroup>
              <SelectLabel>Past</SelectLabel>
              {vm.pastEvents.map((event) => <SelectItem key={event.id} value={event.id}>{event.eventName}</SelectItem>)}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
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
    <FileNeededList id="client-files-needed">
      {vm.needed.map((row) => <NeededRow key={row.requirement.key} row={row} vm={vm} />)}
    </FileNeededList>
  );
}

function FileRow({ file, vm, eventId }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel; eventId: string }) {
  const action = file.objectId ? (
    <FileDownloadButton label={`Download ${file.name}`} busy={vm.activeDownload === file.objectId} disabled={vm.activeDownload !== null} onClick={() => void vm.downloadFile(file.objectId!)} />
  ) : (
    <Link href={dashboardHref("documents", eventId)} className="grid min-h-11 place-items-center text-sm font-medium text-primary hover:text-primary/80" aria-label={`Open ${file.name} in the event`}>
      Open
    </Link>
  );
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

function EventFileList({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  if (vm.filesLoading) return <LoadingState label="Loading files…" className="px-4 py-4" />;
  if (vm.files.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyFilesMessage(vm)}</p>;
  return (
    <>
      {vm.newCount > 0 ? <p className="border-b border-border px-4 py-2 text-xs font-medium text-primary">{vm.newCount} new since your last visit</p> : null}
      <FileTable fromLabel="Added by" sort={vm.sort} onSort={vm.toggleSort}>
        {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} eventId={eventId} />)}
      </FileTable>
    </>
  );
}

function FileLibrary({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  const searchingAll = vm.searchAll && vm.query.trim().length > 0;
  const drop = useFileDrop((files) => void vm.uploadFiles(files), vm.canUpload && !vm.busy);
  return (
    <Card {...drop.props} role="region" aria-label="Files" className={cn("relative gap-0 overflow-hidden py-0", drop.over && "outline outline-2 -outline-offset-2 outline-primary/50")}>
      <FileFilters vm={vm} />
      <ArchiveWarning vm={vm} />
      {searchingAll ? <AccountResults vm={vm} /> : <EventFileList vm={vm} eventId={eventId} />}
      {drop.over ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80 text-sm font-medium text-primary">
          <span className="inline-flex items-center gap-2"><Upload className="size-4" /> Drop to add to this event</span>
        </div>
      ) : null}
    </Card>
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

/**
 * The client's file library. Events sit on the left (upcoming, then past for later reference); the chosen event
 * shows what PMCM still needs from the client, then all of its files on fixed shelves in one table. Opening a
 * file previews it with its review state and versions; files can be dropped on a needed item or on the table.
 */
export function ClientFilesView() {
  const vm = useClientFileLibraryViewModel();
  if (!vm.event) {
    return <ClientListEmpty icon={FileText} title="No event files yet" description="Files appear here once your event workspace is open." />;
  }
  const event = vm.event;

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <EventRail vm={vm} />
      <div className="min-w-0 space-y-4">
        <MobileEventPicker vm={vm} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{event.eventName}</h2>
            <p className="text-sm text-muted-foreground">{eventMeta(event)}</p>
          </div>
          {vm.canUpload ? (
            <Button type="button" onClick={() => vm.startUpload(undefined)} disabled={vm.busy}>
              {vm.busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              {vm.busy ? "Uploading…" : "Upload"}
            </Button>
          ) : null}
        </div>
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
        <FileLibrary vm={vm} eventId={event.id} />
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG or PNG, up to 25 MB each. Uploading sends a file to PMCM for review; it doesn&apos;t approve it.</p>
      </div>
      <ClientFilePreviewSheet vm={vm} eventId={event.id} />
      <ClientFileReuseDialog vm={vm} />
    </div>
  );
}
