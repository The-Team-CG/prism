"use client";

import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { formatFileSize, type PmcmLibraryFile } from "../model/pmcm-file-library";
import { usePmcmFilePreview } from "../view-models/use-pmcm-file-preview";
import type { PmcmFileLibraryViewModel } from "../view-models/use-pmcm-file-library-view-model";
import { PmcmFileKindIcon } from "./pmcm-file-kind-icon";
import { PmcmRejectForm } from "./pmcm-reject-form";

function PreviewBody({ file }: { file: PmcmLibraryFile }) {
  const preview = usePmcmFilePreview(file);
  if (preview.status === "loading") {
    return <div className="grid h-full place-items-center"><LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label="Loading preview" /></div>;
  }
  if (preview.status === "ready") {
    return preview.kind === "pdf" ? (
      <iframe src={`${preview.url}#navpanes=0&view=FitH`} title={`Preview of ${file.name}`} className="h-full w-full rounded-md border border-border bg-background" />
    ) : (
      // A local object URL, which next/image cannot load.
      <img src={preview.url} alt={`Preview of ${file.name}`} className="mx-auto max-h-full max-w-full rounded-md object-contain" />
    );
  }
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-border px-6 text-center">
      <div className="space-y-2">
        <PmcmFileKindIcon kind={file.kind} className="mx-auto size-12" />
        <p className="text-sm text-muted-foreground">
          {preview.status === "error" ? preview.message : "This file type can't be shown here. Download it to open it."}
        </p>
      </div>
    </div>
  );
}

function PreviewActions({ file, vm }: { file: PmcmLibraryFile; vm: PmcmFileLibraryViewModel }) {
  const busy = vm.busy !== null;
  const review = file.review;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {review ? (
        <>
          <Button type="button" size="sm" disabled={busy} onClick={() => void vm.review(review, "approve")}>Approve</Button>
          <PmcmRejectForm fileName={file.name} disabled={busy} onReject={(reason) => void vm.review(review, "reject", reason)} />
        </>
      ) : null}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void vm.download(file.id)}>
        <Download className="size-4" />
        Download
      </Button>
    </div>
  );
}

function previewDetails(file: PmcmLibraryFile) {
  return [file.label ? `For ${file.label}` : null, `From ${file.from}`, formatPortalDateTime(file.addedAt), formatFileSize(file.size), file.status]
    .filter(Boolean)
    .join(" · ");
}

/** A file opened from the library: shown inline when the browser can, with its details and PMCM's decision. */
export function PmcmFilePreviewSheet({ vm }: { vm: PmcmFileLibraryViewModel }) {
  const file = vm.preview;
  return (
    <Sheet open={file !== null} onOpenChange={(open) => { if (!open) vm.closePreview(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-2xl">
        {file ? (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="truncate pr-8">{file.name}</SheetTitle>
              <SheetDescription>{previewDetails(file)}</SheetDescription>
              {file.reviewReason ? <p className="text-sm text-destructive">Rejected: {file.reviewReason}</p> : null}
            </SheetHeader>
            <div className="min-h-0 flex-1"><PreviewBody file={file} /></div>
            <PreviewActions file={file} vm={vm} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
