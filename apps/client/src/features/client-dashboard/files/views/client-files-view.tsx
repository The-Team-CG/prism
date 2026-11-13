"use client";

import Link from "next/link";
import { CheckCircle2, Download, FileSignature, FileText, Files, FolderOpen, LayoutPanelTop, LoaderCircle, ReceiptText, Search, Upload, type LucideIcon } from "lucide-react";
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
import { CLIENT_FILE_CATEGORIES, type ClientFileFilter, type ClientLibraryFile } from "../model/client-file-library";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { useClientFileLibraryViewModel, type ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

const SHELVES: ReadonlyArray<{ id: ClientFileFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All files", icon: Files },
  ...CLIENT_FILE_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    icon: { "files-contracts": FileSignature, "files-quotations": FileText, "files-invoices-receipts": ReceiptText, "files-event-layouts": LayoutPanelTop }[category.id],
  })),
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

/** What an upcoming event still needs from the client, read from its requirements; nothing for past events. */
function EventNeedsCount({ eventId }: { eventId: string }) {
  const requirements = useResource(clientEventFileRequirements, eventId);
  if (requirements.status !== "ready") return null;
  const count = buildClientDocumentChecklist(requirements.data.items, []).rows.filter((row) => row.needsClient).length;
  if (count === 0) return null;
  return <span className="shrink-0 text-xs font-medium tabular-nums text-attention" aria-label={`${count} needed from you`}>{count}</span>;
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

function NeededRow({ row, vm }: { row: ClientDocumentChecklistRow; vm: ClientFileLibraryViewModel }) {
  const { requirement } = row;
  const urgent = requirement.validationStatus === "rejected" || requirement.overdue;
  const replacing = Boolean(row.file) || requirement.validationStatus === "rejected";
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-l-[3px] py-3 pl-3 pr-4", urgent ? "border-l-danger" : "border-l-attention")}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{requirement.label}</p>
        <p className={cn("mt-0.5 text-sm", urgent ? "text-danger" : "text-muted-foreground")}>
          {clientRequirementReviewLabel(row)} · {fileRequirementDueSummary(requirement)}
        </p>
      </div>
      {vm.canUpload ? (
        <Button type="button" size="sm" onClick={() => vm.startUpload(requirement.key)} disabled={vm.busy}>
          <Upload className="size-4" aria-hidden="true" />
          {replacing ? "Replace" : "Upload"}
          <span className="sr-only"> {requirement.label}</span>
        </Button>
      ) : null}
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
        <span className="text-sm tabular-nums text-attention">{vm.needed.length}</span>
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

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_8rem_2.75rem] sm:items-center sm:gap-3";

function FileRow({ file, vm, eventId }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel; eventId: string }) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5", ROW_GRID)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {file.requirementLabel ? `For ${file.requirementLabel}` : null}
            <span className="sm:hidden">{file.requirementLabel ? " · " : ""}{file.addedBy} · <span className={STATUS_TONE[file.tone]}>{file.status}</span></span>
          </p>
        </div>
      </div>
      <span className="hidden truncate text-sm text-muted-foreground sm:block">{file.addedBy}</span>
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{file.addedAt ? formatPortalDate(file.addedAt) : "—"}</span>
      <span className={cn("hidden truncate text-sm sm:block", STATUS_TONE[file.tone])}>{file.status}</span>
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
  return (
    <Card role="region" aria-labelledby="client-files-table" className="gap-0 overflow-hidden py-0">
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
          {vm.query ? "No files match your search." : vm.hasFiles ? `No ${shelf?.label.toLowerCase() ?? "files"} for this event yet.` : "No files for this event yet. Files you send and files PMCM shares appear here."}
        </p>
      ) : (
        <>
          <div aria-hidden="true" className={cn("hidden border-b border-border px-4 py-2 text-xs text-muted-foreground", ROW_GRID)}>
            <span>Name</span><span>Added by</span><span>Date</span><span>Status</span><span />
          </div>
          <ul className="divide-y divide-border">
            {vm.files.map((file) => <FileRow key={file.id} file={file} vm={vm} eventId={eventId} />)}
          </ul>
        </>
      )}
    </Card>
  );
}

/**
 * The client's file library. Events sit on the left (upcoming, then past for later reference); the chosen event
 * shows what PMCM still needs from the client, then all of its files on fixed shelves in one table.
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
          tabIndex={-1}
          aria-label={`Choose a file to upload for ${event.eventName}`}
          accept={ACCEPTED_FILES}
          onChange={(change) => void vm.uploadSelectedFile(change.currentTarget.files?.[0])}
          disabled={vm.busy}
        />
        {vm.error || vm.loadError ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{vm.error ?? vm.loadError}</p> : null}
        {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
        {vm.canUpload ? <NeededSection vm={vm} /> : null}
        <Shelves vm={vm} />
        <FileTable vm={vm} eventId={event.id} />
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG or PNG, up to 25 MB. Uploading sends a file to PMCM for review; it doesn&apos;t approve it.</p>
      </div>
    </div>
  );
}
