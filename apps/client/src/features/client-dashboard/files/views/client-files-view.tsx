"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, Download, FileSignature, FileText, Files, FolderOpen, LayoutPanelTop, LoaderCircle, ReceiptText, Search, Upload, type LucideIcon } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { useResource } from "@prism/portal-query";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDate } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { ClientListEmpty, type ClientRowTone } from "../../shared/client-list-ui";
import { clientEventFileRequirements } from "../data/client-file-library-resources";
import { buildClientDocumentChecklist, clientRequirementReviewLabel, type ClientDocumentChecklistRow } from "../model/client-document-checklist";
import { CLIENT_FILE_CATEGORIES, formatFileSize, type ClientFileFilter, type ClientFileSort, type ClientLibraryFile } from "../model/client-file-library";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { useClientFileLibraryViewModel, type ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFileKindIcon } from "./client-file-kind-icon";
import { ClientFilePreviewSheet } from "./client-file-preview-sheet";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

const SHELF_ICONS: Record<(typeof CLIENT_FILE_CATEGORIES)[number]["id"], LucideIcon> = {
  "files-contracts": FileSignature,
  "files-quotations": FileText,
  "files-invoices-receipts": ReceiptText,
  "files-event-layouts": LayoutPanelTop,
};

const SHELVES: ReadonlyArray<{ id: ClientFileFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All files", icon: Files },
  ...CLIENT_FILE_CATEGORIES.map((category) => ({ id: category.id, label: category.label, icon: SHELF_ICONS[category.id] })),
  { id: "other", label: "Other", icon: FolderOpen },
];

const STATUS_TONE: Record<ClientRowTone, string> = {
  urgent: "font-medium text-danger",
  attention: "text-attention",
  done: "text-success",
  neutral: "text-muted-foreground",
};

function eventMeta(event: PrismEvent) {
  return [formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed", formatStatusLabel(event.status)].join(" · ");
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Drag-and-drop for an area: highlights while files hover over it and hands dropped files to `onFiles`. */
function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean) {
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  if (!enabled) return { over: false, props: {} };
  return {
    over,
    props: {
      onDragEnter: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (hasFiles(event)) event.preventDefault();
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setOver(false);
        onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
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
    <Button type="button" size="sm" onClick={() => vm.startUpload(requirement.key)} disabled={vm.busy}>
      <Upload className="size-4" aria-hidden="true" />
      {replacing ? "Replace" : "Upload"}
      <span className="sr-only"> {requirement.label}</span>
    </Button>
  );
}

function NeededRow({ row, vm }: { row: ClientDocumentChecklistRow; vm: ClientFileLibraryViewModel }) {
  const { requirement } = row;
  const urgent = requirement.validationStatus === "rejected" || requirement.overdue;
  const rejectionReason = requirement.validationStatus === "rejected" ? requirement.reviewReason : undefined;
  const drop = useFileDrop((files) => void vm.uploadFiles(files, requirement.key), vm.canUpload && !vm.busy);
  return (
    <li
      {...drop.props}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-[3px] py-3 pl-3 pr-4 transition-colors",
        urgent ? "border-l-danger" : "border-l-attention",
        drop.over && "bg-primary/5 outline outline-2 -outline-offset-2 outline-primary/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{requirement.label}</p>
        <p className={cn("mt-0.5 text-sm", urgent ? "text-danger" : "text-muted-foreground")}>
          {clientRequirementReviewLabel(row)} · {fileRequirementDueSummary(requirement)}
        </p>
        {rejectionReason ? (
          <p className="mt-1 text-sm text-foreground">
            <span className="text-muted-foreground">PMCM:</span> {rejectionReason}
          </p>
        ) : null}
        {drop.over ? <p className="mt-1 text-xs font-medium text-primary">Drop to send for {requirement.label}</p> : null}
      </div>
      {vm.canUpload ? <NeededRowActions row={row} vm={vm} /> : null}
    </li>
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
    <Card role="region" aria-labelledby="client-files-needed" className="gap-0 overflow-hidden py-0">
      <header className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id="client-files-needed" className="text-sm font-semibold text-foreground">Needed from you</h3>
        <span className="hidden text-xs text-muted-foreground sm:inline">Drop a file on an item to send it</span>
      </header>
      <ul className="divide-y divide-border">
        {vm.needed.map((row) => <NeededRow key={row.requirement.key} row={row} vm={vm} />)}
      </ul>
    </Card>
  );
}

function Shelves({ vm }: { vm: ClientFileLibraryViewModel }) {
  const shelves = SHELVES.filter((shelf) => shelf.id !== "other" || vm.counts.other > 0);
  return (
    <div role="group" aria-label="File categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:auto-cols-fr sm:grid-flow-col sm:overflow-visible">
      {shelves.map(({ id, label, icon: Icon }) => {
        const active = vm.filter === id;
        const count = vm.counts[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => vm.setFilter(id)}
            className={cn(
              "min-w-32 shrink-0 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface-raised sm:min-w-0",
              active ? "border-foreground/40 shadow-sm" : "border-border",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
            </span>
            <span className={cn("mt-0.5 block text-xs tabular-nums", count ? "text-muted-foreground" : "text-muted-foreground/60")}>{count === 1 ? "1 file" : `${count} files`}</span>
          </button>
        );
      })}
    </div>
  );
}

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_4.5rem_7.5rem_2.75rem] sm:items-center sm:gap-3";

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: ClientFileSort["key"]; sort: ClientFileSort; onSort: (key: ClientFileSort["key"]) => void }) {
  const active = sort.key === sortKey;
  const Arrow = sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 text-left hover:text-foreground", active && "font-medium text-foreground")} aria-label={`Sort by ${label.toLowerCase()}`}>
      {label}
      {active ? <Arrow className="size-3" aria-hidden="true" /> : null}
    </button>
  );
}

function FileRow({ file, vm, eventId }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel; eventId: string }) {
  const size = formatFileSize(file.size);
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-raised", ROW_GRID)}>
      <button type="button" onClick={() => vm.openPreview(file.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-0.5 text-left" aria-label={`Preview ${file.name}`}>
        <ClientFileKindIcon kind={file.kind} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {file.requirementLabel ? `For ${file.requirementLabel}` : null}
            <span className="sm:hidden">{file.requirementLabel ? " · " : ""}{file.addedBy} · <span className={STATUS_TONE[file.tone]}>{file.status}</span></span>
          </span>
        </span>
      </button>
      <span className="hidden truncate text-sm text-muted-foreground sm:block">{file.addedBy}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{file.addedAt ? formatPortalDate(file.addedAt) : "—"}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{size ?? "—"}</span>
      <span className={cn("hidden truncate text-sm sm:block", STATUS_TONE[file.tone])} title={file.reviewReason}>{file.status}</span>
      {file.objectId ? (
        <button
          type="button"
          onClick={() => void vm.downloadFile(file.objectId!)}
          disabled={vm.activeDownload !== null}
          aria-label={`Download ${file.name}`}
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {vm.activeDownload === file.objectId ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        </button>
      ) : (
        <Link href={dashboardHref("documents", eventId)} className="grid min-h-11 shrink-0 place-items-center text-sm font-medium text-primary hover:text-primary/80" aria-label={`Open ${file.name} in the event`}>
          Open
        </Link>
      )}
    </li>
  );
}

function FileTable({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  const shelf = SHELVES.find((entry) => entry.id === vm.filter);
  const drop = useFileDrop((files) => void vm.uploadFiles(files), vm.canUpload && !vm.busy);
  return (
    <Card {...drop.props} role="region" aria-labelledby="client-files-table" className={cn("relative gap-0 overflow-hidden py-0", drop.over && "outline outline-2 -outline-offset-2 outline-primary/50")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 id="client-files-table" className="text-sm font-semibold text-foreground">
          {shelf?.label ?? "All files"} <span className="font-normal tabular-nums text-muted-foreground">{vm.files.length}</span>
        </h3>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search this event&apos;s files</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={vm.query}
            onChange={(event) => vm.setQuery(event.currentTarget.value)}
            placeholder="Search files"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </header>
      {vm.filesLoading ? (
        <LoadingState label="Loading files…" className="px-4 py-4" />
      ) : vm.files.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {vm.query ? "No files match your search." : vm.hasFiles ? `No ${shelf?.label.toLowerCase() ?? "files"} for this event yet.` : vm.canUpload ? "No files for this event yet. Drop files here or use Upload; files PMCM shares appear here too." : "No files were kept for this event."}
        </p>
      ) : (
        <>
          <div className={cn("hidden border-b border-border px-4 py-2 text-xs text-muted-foreground", ROW_GRID)}>
            <SortHeader label="Name" sortKey="name" sort={vm.sort} onSort={vm.toggleSort} />
            <span>Added by</span>
            <SortHeader label="Date" sortKey="date" sort={vm.sort} onSort={vm.toggleSort} />
            <span>Size</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} eventId={eventId} />)}
          </ul>
        </>
      )}
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
        <Shelves vm={vm} />
        <FileTable vm={vm} eventId={event.id} />
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG or PNG, up to 25 MB each. Uploading sends a file to PMCM for review; it doesn&apos;t approve it.</p>
      </div>
      <ClientFilePreviewSheet vm={vm} eventId={event.id} />
    </div>
  );
}
