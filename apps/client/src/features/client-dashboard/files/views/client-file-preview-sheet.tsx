"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Download, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { CLIENT_FILE_CATEGORIES, formatFileSize, type ClientLibraryFile } from "../model/client-file-library";
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

/**
 * A file opened from the library: the file itself when the browser can show it, then what it is for, its review
 * state and PMCM's reason, earlier versions, and the actions that apply. Up and down step through the list.
 */
export function ClientFilePreviewSheet({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  const file = vm.preview;
  const index = file ? vm.files.findIndex((entry) => entry.id === file.id) : -1;
  return (
    <Sheet open={Boolean(file)} onOpenChange={(open) => { if (!open) vm.closePreview(); }}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); vm.stepPreview(1); }
          if (event.key === "ArrowUp") { event.preventDefault(); vm.stepPreview(-1); }
        }}
      >
        {file ? (
          <>
            <SheetHeader className="border-b border-border pr-12">
              <div className="flex items-start gap-3">
                <ClientFileKindIcon kind={file.kind} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="break-words text-base">{file.name}</SheetTitle>
                  <SheetDescription>
                    {[file.addedBy === "You" ? "Added by you" : `Added by ${file.addedBy}`, file.addedAt ? formatPortalDate(file.addedAt) : null, formatFileSize(file.size)].filter(Boolean).join(" · ")}
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Previous file" disabled={index <= 0} onClick={() => vm.stepPreview(-1)}><ChevronUp className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Next file" disabled={index < 0 || index >= vm.files.length - 1} onClick={() => vm.stepPreview(1)}><ChevronDown className="size-4" /></Button>
                </div>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className={cn("bg-muted/40 p-3", clientFileHasPreview(file) ? "h-[55vh]" : "h-40")}>
                <PreviewBody key={file.id} file={file} />
              </div>

              <div className="space-y-4 p-4">
                {file.reviewReason ? (
                  <p role="note" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                    <span className="font-semibold">PMCM didn&apos;t accept this file:</span> {file.reviewReason}
                  </p>
                ) : null}
                <dl className="divide-y divide-border">
                  <Detail label="Status"><span className={STATUS_TONE[file.tone]}>{file.status}</span></Detail>
                  {file.requirementLabel ? <Detail label="Sent for">{file.requirementLabel}</Detail> : null}
                  <Detail label="Category">{CLIENT_FILE_CATEGORIES.find((category) => category.id === file.category)?.label ?? "Other"}</Detail>
                </dl>

                {file.versions && file.versions.length > 1 ? (
                  <section aria-labelledby="client-file-versions">
                    <h3 id="client-file-versions" className="text-sm font-semibold text-foreground">Versions</h3>
                    <ol className="mt-1 divide-y divide-border">
                      {file.versions.map((version, position) => (
                        <li key={version.documentId} className="flex items-center gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm", version.objectId === file.objectId ? "font-semibold text-foreground" : "text-foreground")}>
                              v{file.versions!.length - position} · {version.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPortalDateTime(version.uploadedAt)} · {formatStatusLabel(version.status)}
                              {version.reviewReason ? ` · ${version.reviewReason}` : ""}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Download version ${file.versions!.length - position}`} onClick={() => void vm.downloadFile(version.objectId)} disabled={vm.activeDownload !== null}>
                            {vm.activeDownload === version.objectId ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                          </Button>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>
            </div>

            <footer className="flex flex-wrap gap-2 border-t border-border p-4">
              {file.objectId ? (
                <Button type="button" onClick={() => void vm.downloadFile(file.objectId!)} disabled={vm.activeDownload !== null}>
                  {vm.activeDownload === file.objectId ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download
                </Button>
              ) : (
                <Button asChild><Link href={dashboardHref("documents", eventId)}>Open in event</Link></Button>
              )}
              {file.replaceable && file.requirementKey && vm.canUpload ? (
                <Button type="button" variant="outline" onClick={() => vm.startUpload(file.requirementKey)} disabled={vm.busy}>
                  <Upload className="size-4" /> Replace
                </Button>
              ) : null}
            </footer>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
