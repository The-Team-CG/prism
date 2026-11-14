"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Download, File, FileImage, FileSpreadsheet, FileText, FileVideo, LoaderCircle, Search, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { PrismEmptyLine, PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatDate } from "../../model/supplier-workspace-rules";
import { supplierBookingHref } from "../../model/supplier-next-step";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import type { SupplierFileFilter, SupplierFileKind, SupplierFileTone, SupplierLibraryFile, SupplierNeededFile } from "../../model/supplier-file-library";
import { useSupplierFileLibraryViewModel, useSupplierFilePreview, type SupplierFileLibraryViewModel } from "../../view-models/use-supplier-file-library-view-model";

const FILTERS: ReadonlyArray<{ id: SupplierFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  { id: "booking", label: "Booking documents" },
  { id: "contract", label: "Contracts" },
  { id: "certification", label: "Certifications" },
];

const TONE: Record<SupplierFileTone, string> = {
  attention: "text-attention",
  urgent: "text-destructive",
  done: "text-success",
  neutral: "text-muted-foreground",
};

const ICONS = { pdf: FileText, document: FileText, image: FileImage, sheet: FileSpreadsheet, video: FileVideo, other: File } as const;

function KindIcon({ kind }: { kind: SupplierFileKind }) {
  const Icon = ICONS[kind];
  return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true"><Icon className="size-4" /></span>;
}

function neededDetail(item: SupplierNeededFile) {
  const due = item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date";
  return `${item.eventName} · ${due}`;
}

function NeededAction({ item, vm }: { item: SupplierNeededFile; vm: SupplierFileLibraryViewModel }) {
  if (item.bookingRequestId) {
    return <Button asChild size="sm" variant="outline"><Link href={supplierBookingHref(item.bookingRequestId)}>Open booking</Link></Button>;
  }
  const uploading = vm.uploading === `${item.eventId}:${item.key}`;
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
      {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
      {uploading ? "Uploading" : item.replacing ? "Replace" : "Upload"}
      <input
        type="file"
        className="sr-only"
        aria-label={`Upload ${item.label} for ${item.eventName}`}
        disabled={vm.uploading !== null}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void vm.upload(item.eventId, item.key, file);
        }}
      />
    </label>
  );
}

function NeededRow({ item, vm }: { item: SupplierNeededFile; vm: SupplierFileLibraryViewModel }) {
  const [over, setOver] = useState(false);
  const droppable = !item.bookingRequestId && vm.uploading === null;
  function drop(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files?.[0];
    if (droppable && file) void vm.upload(item.eventId, item.key, file);
  }
  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-5 py-4 ${over ? "bg-primary/5 ring-2 ring-inset ring-primary/40" : ""}`}
      onDragOver={(event) => { if (droppable) { event.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {neededDetail(item)}
          {item.overdue ? <span className="font-semibold text-destructive"> · Overdue</span> : null}
        </p>
        {item.reviewReason ? <p className="mt-1 text-sm text-destructive">PMCM: {item.reviewReason}</p> : null}
      </div>
      <NeededAction item={item} vm={vm} />
    </li>
  );
}

function NeededSection({ vm }: { vm: SupplierFileLibraryViewModel }) {
  if (vm.status === "loading") return <LoadingState label="Loading what PMCM needs from you…" />;
  return (
    <PrismSection id="supplier-files-needed" title="Needed from you" description="Drop a file on an item to send it to PMCM." flush={vm.needed.length > 0}>
      {vm.error ? <p role="alert" className="px-5 py-2 text-sm text-destructive">{vm.error}</p> : null}
      {vm.needed.length === 0 ? (
        <PrismEmptyLine icon={CheckCircle2}>Nothing needed right now. PMCM will ask here when a booking needs a file from you.</PrismEmptyLine>
      ) : (
        <ul className="divide-y divide-border">{vm.needed.map((item) => <NeededRow key={`${item.eventId}:${item.key}`} item={item} vm={vm} />)}</ul>
      )}
    </PrismSection>
  );
}

function FileRow({ file, vm, onDownloadObject }: { file: SupplierLibraryFile; vm: SupplierFileLibraryViewModel; onDownloadObject: (objectId: string) => void }) {
  const objectId = file.objectId;
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 md:grid-cols-[minmax(0,2fr)_0.8fr_1fr_auto]">
      <button type="button" className="flex min-w-0 items-center gap-3 text-left" aria-label={`Open ${file.name}`} onClick={() => vm.openPreview(file.id)}>
        <KindIcon kind={file.kind} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{file.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{file.context}</span>
        </span>
      </button>
      <span className="hidden text-sm text-muted-foreground md:block">{formatDate(file.addedAt)}</span>
      <span className={`hidden text-sm font-medium md:block ${TONE[file.tone]}`}>{file.status}</span>
      {objectId ? (
        <Button type="button" variant="ghost" size="icon" aria-label={`Download ${file.name}`} onClick={() => onDownloadObject(objectId)}><Download className="size-4" /></Button>
      ) : <span className="w-9" />}
    </li>
  );
}

function FilesSection({ vm, onDownloadObject }: { vm: SupplierFileLibraryViewModel; onDownloadObject: (objectId: string) => void }) {
  return (
    <PrismSection id="supplier-files-library" title="Your files" description="Everything you have sent PMCM, and certifications PMCM keeps on your record." flush>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
        <div role="group" aria-label="Show files" className="flex flex-wrap gap-1.5">
          {FILTERS.map((entry) => (
            <Button key={entry.id} type="button" size="sm" variant={vm.filter === entry.id ? "secondary" : "ghost"} aria-pressed={vm.filter === entry.id} onClick={() => vm.setFilter(entry.id)}>
              {entry.label}
              <span className="tabular-nums text-muted-foreground">{vm.counts[entry.id]}</span>
            </Button>
          ))}
        </div>
        <label className="relative block w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={vm.query} onChange={(event) => vm.setQuery(event.target.value)} placeholder="Search files" aria-label="Search your files" className="pl-8" />
        </label>
      </div>
      {vm.files.length === 0 ? (
        <div className="px-5 pb-4"><PrismEmptyLine icon={FileText}>{vm.query || vm.filter !== "all" ? "No files match." : "No files yet. Files you send PMCM will be kept here."}</PrismEmptyLine></div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {vm.files.map((file) => <FileRow key={`${file.group}:${file.id}`} file={file} vm={vm} onDownloadObject={onDownloadObject} />)}
        </ul>
      )}
    </PrismSection>
  );
}

function PreviewBody({ file, session }: { file: SupplierLibraryFile; session: PrismAuthenticatedSession }) {
  const preview = useSupplierFilePreview(session, file);
  if (preview.status === "loading") return <div className="grid h-full place-items-center"><LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label="Loading preview" /></div>;
  if (preview.status === "ready") {
    return preview.kind === "pdf" ? (
      <iframe src={`${preview.url}#navpanes=0&view=FitH`} title={`Preview of ${file.name}`} className="h-full w-full rounded-md border border-border bg-background" />
    ) : (
      // A local object URL, which next/image cannot load.
      <img src={preview.url} alt={`Preview of ${file.name}`} className="mx-auto max-h-full max-w-full rounded-md object-contain" />
    );
  }
  const message = preview.status === "error" ? preview.message : file.objectId ? "This file type can't be shown here. Download it to open it." : "PMCM keeps this file on your supplier record.";
  return <div className="grid h-full place-items-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">{message}</div>;
}

function PreviewSheet({ vm, session, onDownloadObject }: { vm: SupplierFileLibraryViewModel; session: PrismAuthenticatedSession; onDownloadObject: (objectId: string) => void }) {
  const file = vm.preview;
  const objectId = file?.objectId;
  return (
    <Sheet open={file !== null} onOpenChange={(open) => { if (!open) vm.closePreview(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-2xl">
        {file ? (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="truncate pr-8">{file.name}</SheetTitle>
              <SheetDescription>{file.context} · {formatDate(file.addedAt)} · {file.status}</SheetDescription>
              {file.reviewReason ? <p className="text-sm text-destructive">PMCM: {file.reviewReason}</p> : null}
            </SheetHeader>
            <div className="min-h-0 flex-1"><PreviewBody file={file} session={session} /></div>
            {objectId ? (
              <div className="border-t border-border pt-3">
                <Button type="button" size="sm" variant="outline" onClick={() => onDownloadObject(objectId)}><Download className="size-4" />Download</Button>
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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
