"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Download, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { CLIENT_FILE_CATEGORIES, clientFileExpiry, formatFileSize, type ClientLibraryFile } from "../model/client-file-library";
import { clientFileHasPreview, useClientFilePreview } from "../view-models/use-client-file-preview";
import type { ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFileKindIcon } from "./client-file-kind-icon";

const STATUS_TONE: Record<ClientLibraryFile["tone"], string> = {
  urgent: "text-danger",
  attention: "text-attention",
  done: "text-success",
  neutral: "text-muted-foreground",
};

function PreviewBody({ file }: { file: ClientLibraryFile }) {
  const preview = useClientFilePreview(file);
  if (preview.status === "loading") {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-label="Loading preview" /></div>;
  }
  if (preview.status === "ready") {
    return preview.kind === "pdf" ? (
      <iframe src={`${preview.url}#navpanes=0&view=FitH`} title={`Preview of ${file.name}`} className="h-full w-full rounded-md border border-border bg-background" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- a local object URL; next/image cannot optimize it
      <img src={preview.url} alt={`Preview of ${file.name}`} className="mx-auto max-h-full max-w-full rounded-md object-contain" />
    );
  }
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-border px-6 text-center">
      <div className="space-y-2">
        <ClientFileKindIcon kind={file.kind} className="mx-auto size-10" />
        <p className="text-sm text-muted-foreground">
          {preview.status === "error"
            ? preview.message
            : file.objectId
              ? "This file type can't be shown here. Download it to open it."
              : "PMCM keeps this record in the event workspace."}
        </p>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

function PreviewHeader({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  const index = vm.files.findIndex((entry) => entry.id === file.id);
  const meta = [file.addedBy === "You" ? "Added by you" : `Added by ${file.addedBy}`, file.addedAt ? formatPortalDate(file.addedAt) : null, formatFileSize(file.size)];
  return (
    <SheetHeader className="border-b border-border pr-12">
      <div className="flex items-start gap-3">
        <ClientFileKindIcon kind={file.kind} />
        <div className="min-w-0 flex-1">
          <SheetTitle className="break-words text-base">{file.name}</SheetTitle>
          <SheetDescription>{meta.filter(Boolean).join(" · ")}</SheetDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Previous file" disabled={index <= 0} onClick={() => vm.stepPreview(-1)}><ChevronUp className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Next file" disabled={index < 0 || index >= vm.files.length - 1} onClick={() => vm.stepPreview(1)}><ChevronDown className="size-4" /></Button>
        </div>
      </div>
    </SheetHeader>
  );
}

/**
 * When a dated document stops being valid (a permit, insurance or registration). The client can set or clear the
 * date on files they sent; PMCM's files only show it.
 */
function ValidUntil({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  const [value, setValue] = useState(file.expiresAt?.slice(0, 10) ?? "");
  const expiry = clientFileExpiry(file.expiresAt);
  const editable = file.addedBy === "You" && Boolean(file.objectId);
  if (!editable) return expiry ? <Detail label="Valid until"><span className={STATUS_TONE[expiry.tone]}>{expiry.label}</span></Detail> : null;
  return (
    <Detail label="Valid until">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void vm.setExpiry(file, value || null); }}>
        <input type="date" aria-label={`Valid until for ${file.name}`} value={value} onChange={(event) => setValue(event.currentTarget.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={vm.busy || value === (file.expiresAt?.slice(0, 10) ?? "")}>Save</Button>
        {file.expiresAt ? <Button type="button" size="sm" variant="ghost" disabled={vm.busy} onClick={() => { setValue(""); void vm.setExpiry(file, null); }}>Clear</Button> : null}
        {expiry && expiry.tone !== "neutral" ? <span className={cn("text-xs", STATUS_TONE[expiry.tone])}>{expiry.label}</span> : null}
      </form>
    </Detail>
  );
}

function PreviewDetails({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  return (
    <>
      {file.reviewReason ? (
        <p role="note" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          <span className="font-semibold">PMCM didn&apos;t accept this file:</span> {file.reviewReason}
        </p>
      ) : null}
      <dl className="divide-y divide-border">
        <Detail label="Status"><span className={STATUS_TONE[file.tone]}>{file.status}</span></Detail>
        {file.requirementLabel ? <Detail label="Sent for">{file.requirementLabel}</Detail> : null}
        <Detail label="Category">{CLIENT_FILE_CATEGORIES.find((category) => category.id === file.category)?.label ?? "Other"}</Detail>
        <ValidUntil key={`${file.id}:${file.expiresAt ?? ""}`} file={file} vm={vm} />
      </dl>
    </>
  );
}

/** Every upload for the file's requirement, newest first; the current one is in bold. */
function PreviewVersions({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  const versions = file.versions ?? [];
  if (versions.length < 2) return null;
  return (
    <section aria-labelledby="client-file-versions">
      <h3 id="client-file-versions" className="text-sm font-semibold text-foreground">Versions</h3>
      <ol className="mt-1 divide-y divide-border">
        {versions.map((version, position) => {
          const number = versions.length - position;
          return (
            <li key={version.documentId} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm text-foreground", version.objectId === file.objectId && "font-semibold")}>v{number} · {version.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {[formatPortalDateTime(version.uploadedAt), formatStatusLabel(version.status), version.reviewReason].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Download version ${number}`} onClick={() => void vm.downloadFile(version.objectId)} disabled={vm.activeDownload !== null}>
                {vm.activeDownload === version.objectId ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PreviewActions({ file, vm, eventId }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel; eventId: string }) {
  const canReplace = Boolean(file.replaceable && file.requirementKey && vm.canUpload);
  return (
    <footer className="flex flex-wrap gap-2 border-t border-border p-4">
      {file.objectId ? (
        <Button type="button" onClick={() => void vm.downloadFile(file.objectId!)} disabled={vm.activeDownload !== null}>
          {vm.activeDownload === file.objectId ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download
        </Button>
      ) : (
        <Button asChild><Link href={dashboardHref("documents", eventId)}>Open in event</Link></Button>
      )}
      {canReplace ? (
        <Button type="button" variant="outline" onClick={() => vm.startUpload(file.requirementKey)} disabled={vm.busy}>
          <Upload className="size-4" /> Replace
        </Button>
      ) : null}
    </footer>
  );
}

/**
 * A file opened from the library: the file itself when the browser can show it, then what it is for, its review
 * state and PMCM's reason, earlier versions, and the actions that apply. Up and down step through the list.
 */
export function ClientFilePreviewSheet({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  const file = vm.preview;
  const step = (event: React.KeyboardEvent) => {
    // Arrow keys inside a field (the date picker) belong to that field.
    if (event.target instanceof HTMLInputElement) return;
    const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    vm.stepPreview(offset);
  };
  return (
    <Sheet open={Boolean(file)} onOpenChange={(open) => { if (!open) vm.closePreview(); }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl" onKeyDown={step}>
        {file ? (
          <>
            <PreviewHeader file={file} vm={vm} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className={cn("bg-muted/40 p-3", clientFileHasPreview(file) ? "h-[55vh]" : "h-40")}>
                <PreviewBody key={file.id} file={file} />
              </div>
              <div className="space-y-4 p-4">
                <PreviewDetails file={file} vm={vm} />
                <PreviewVersions file={file} vm={vm} />
              </div>
            </div>
            <PreviewActions file={file} vm={vm} eventId={eventId} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
