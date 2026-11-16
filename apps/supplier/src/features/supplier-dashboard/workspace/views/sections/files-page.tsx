"use client";

import Link from "next/link";
import { CheckCircle2, Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { LoadingState } from "@prism/ui/components/loading-state";
import { EventCardGrid, EventCover } from "@prism/ui/event-cards";
import {
  FILE_TONE,
  FileDetail,
  FileDownloadButton,
  FileEventCard,
  FileEventHeading,
  FileFilterBar,
  FileLibraryPanel,
  FileNeededList,
  FileNeededRow,
  FilePreviewFrame,
  FilePreviewSheet,
  FileReviewNote,
  FileTable,
  FileTableRow,
  FileValidUntil,
  fileEventHref,
  useFileDrop,
  useFileEventChoice,
} from "@prism/ui/file-library";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismPageColumn } from "@prism/ui/page-blocks";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatDate } from "../../model/supplier-workspace-rules";
import { supplierBookingHref } from "../../model/supplier-next-step";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import type { SupplierFileEvent, SupplierFileFilter, SupplierLibraryFile, SupplierNeededFile } from "../../model/supplier-file-library";
import { useEventCoverUrl } from "../../view-models/use-event-cover-url";
import { useSupplierFileLibraryViewModel, useSupplierFilePreview, type SupplierFileLibraryViewModel } from "../../view-models/use-supplier-file-library-view-model";

const FILTERS: ReadonlyArray<{ id: SupplierFileFilter; label: string }> = [
  { id: "all", label: "All files" },
  { id: "booking", label: "Booking documents" },
  { id: "contract", label: "Contracts" },
];

function neededDetail(item: SupplierNeededFile) {
  const due = item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date";
  return [due, item.overdue ? "Overdue" : null].filter(Boolean).join(" · ");
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

function Notices({ vm }: { vm: SupplierFileLibraryViewModel }) {
  const error = vm.error ?? vm.saveError;
  return (
    <>
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {vm.notice ? <p role="status" className="text-sm text-success">{vm.notice}</p> : null}
    </>
  );
}

function NeededSection({ vm }: { vm: SupplierFileLibraryViewModel }) {
  if (vm.needed.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-sm text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Nothing needed from you for this booking. PMCM will ask here when it needs a file.
      </p>
    );
  }
  return (
    <FileNeededList id="supplier-files-needed" count={vm.needed.length}>
      {vm.needed.map((item) => <NeededRow key={`${item.eventId}:${item.key}`} item={item} vm={vm} />)}
    </FileNeededList>
  );
}

function FileRow({ file, vm, inEvent, onDownloadObject }: { file: SupplierLibraryFile; vm: SupplierFileLibraryViewModel; inEvent: boolean; onDownloadObject: (objectId: string) => void }) {
  const objectId = file.objectId;
  return (
    <FileTableRow
      kind={file.kind}
      name={file.name}
      detail={inEvent ? file.purpose ?? file.context : file.context}
      from={file.group === "certification" ? "PMCM" : "You"}
      addedAt={file.addedAt}
      size={file.size}
      status={{ label: file.status, tone: file.tone, expiresAt: file.expiresAt, title: file.reviewReason }}
      onOpen={() => vm.openPreview(file.id)}
      action={objectId ? <FileDownloadButton label={`Download ${file.name}`} onClick={() => onDownloadObject(objectId)} /> : null}
    />
  );
}

function FileList({ vm, inEvent, empty, onDownloadObject }: { vm: SupplierFileLibraryViewModel; inEvent: boolean; empty: string; onDownloadObject: (objectId: string) => void }) {
  if (vm.files.length === 0) {
    return <div className="px-4 py-4"><PrismEmptyLine icon={FileText}>{vm.query || vm.filter !== "all" ? "No files match." : empty}</PrismEmptyLine></div>;
  }
  return (
    <FileTable>
      {vm.files.map((file) => <FileRow key={`${file.group}:${file.id}`} file={file} vm={vm} inEvent={inEvent} onDownloadObject={onDownloadObject} />)}
    </FileTable>
  );
}

function SupplierFileEventCard({ event, todayKey, onOpen }: { event: SupplierFileEvent; todayKey: string; onOpen: (eventId: string) => void }) {
  const coverUrl = useEventCoverUrl(event.eventId, event.coverObjectId);
  return (
    <FileEventCard
      cover={<EventCover eventType={event.eventType} imageUrl={coverUrl} />}
      date={event.eventDate}
      title={event.eventName}
      titleLabel={`Open files: ${event.eventName}`}
      href={fileEventHref(event.eventId)}
      onNavigate={() => onOpen(event.eventId)}
      details={[event.categories, "for PMCM"].filter(Boolean).join(" · ")}
      todayKey={todayKey}
      finished={event.past}
      tally={event.tally}
    />
  );
}

function CardSection({ id, title, events, todayKey, onOpen }: { id: string; title: string; events: SupplierFileEvent[]; todayKey: string; onOpen: (eventId: string) => void }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">{title}<span className="text-sm font-normal tabular-nums text-muted-foreground">{events.length}</span></h2>
      <EventCardGrid>{events.map((event) => <SupplierFileEventCard key={event.eventId} event={event} todayKey={todayKey} onOpen={onOpen} />)}</EventCardGrid>
    </section>
  );
}

/** Files' start page: each booked event as the Files card every portal shares, then the certifications PMCM keeps on file. */
function StartPage({ vm, onOpen, onDownloadObject }: { vm: SupplierFileLibraryViewModel; onOpen: (eventId: string) => void; onDownloadObject: (objectId: string) => void }) {
  const todayKey = manilaDateKey();
  return (
    <>
      <Notices vm={vm} />
      {vm.events.length === 0 ? (
        <PrismEmptyLine icon={FileText}>No bookings yet. The files PMCM asks for appear here once you are booked for an event.</PrismEmptyLine>
      ) : (
        <>
          <CardSection id="supplier-files-upcoming" title="Upcoming" events={vm.events.filter((event) => !event.past)} todayKey={todayKey} onOpen={onOpen} />
          <CardSection id="supplier-files-past" title="Past" events={vm.events.filter((event) => event.past)} todayKey={todayKey} onOpen={onOpen} />
        </>
      )}
      <FileLibraryPanel
        title="Your supplier record"
        description="Certifications PMCM keeps on file for you. They count for every booking."
        files={<FileList vm={vm} inEvent={false} empty="PMCM has no certifications on file for you yet." onDownloadObject={onDownloadObject} />}
      />
    </>
  );
}

/** One booked event's files, in the Library panel every portal shares. */
function EventLibrary({ vm, event, onBack, onDownloadObject }: { vm: SupplierFileLibraryViewModel; event: SupplierFileEvent; onBack: () => void; onDownloadObject: (objectId: string) => void }) {
  return (
    <>
      <FileEventHeading
        title={event.eventName}
        meta={[event.categories, event.eventDate ? formatPortalDate(event.eventDate) : "Date to be confirmed"].filter(Boolean).join(" · ")}
        onBack={onBack}
      />
      <FileLibraryPanel
        description="Everything you have sent PMCM for this booking. PMCM reviews each file."
        files={(
          <>
            <FileFilterBar
              label="Show files"
              filters={FILTERS.map((entry) => ({ ...entry, count: vm.counts[entry.id] }))}
              value={vm.filter}
              onChange={vm.setFilter}
              query={vm.query}
              onQuery={vm.setQuery}
              searchLabel="Search this booking's files"
            />
            <FileList vm={vm} inEvent empty="No files yet. Files you send PMCM for this booking are kept here." onDownloadObject={onDownloadObject} />
          </>
        )}
      >
        <Notices vm={vm} />
        <NeededSection vm={vm} />
      </FileLibraryPanel>
    </>
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

/**
 * The supplier's Files, drawn after PMCM's: every booked event as a card saying how many of the files PMCM asked for
 * are in, then the chosen event's library with what PMCM still needs and every file sent for it.
 */
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
  const { eventId, choose } = useFileEventChoice();
  const vm = useSupplierFileLibraryViewModel({ workspace, session, workflowWorkspace, readinessBoard, eventId });
  return (
    <PrismPageColumn>
      {vm.status === "loading" ? <LoadingState label="Loading your files…" /> : null}
      {vm.status !== "loading" && vm.event ? <EventLibrary vm={vm} event={vm.event} onBack={() => choose(null)} onDownloadObject={onDownloadObject} /> : null}
      {vm.status !== "loading" && !vm.event ? <StartPage vm={vm} onOpen={choose} onDownloadObject={onDownloadObject} /> : null}
      <PreviewSheet vm={vm} session={session} onDownloadObject={onDownloadObject} />
    </PrismPageColumn>
  );
}
