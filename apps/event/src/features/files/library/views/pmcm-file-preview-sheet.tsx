"use client";

import { Download, ImageIcon, ImageOff } from "lucide-react";
import { PmcmDeleteFileButton } from "./pmcm-delete-file-button";
import { Button } from "@prism/ui/components/button";
import { FILE_TONE, FileDetail, FilePreviewFrame, FilePreviewSheet, FileReviewNote, FileValidUntil, formatFileSize } from "@prism/ui/file-library";
import { formatPortalDateTime } from "@prism/ui/format-date";
import type { PmcmLibraryFile } from "../model/pmcm-file-library";
import { usePmcmFilePreview } from "../view-models/use-pmcm-file-preview";
import type { PmcmFileLibraryViewModel } from "../view-models/use-pmcm-file-library-view-model";
import { PmcmRejectForm } from "./pmcm-reject-form";

function PreviewFrame({ file }: { file: PmcmLibraryFile }) {
  const preview = usePmcmFilePreview(file);
  return <FilePreviewFrame state={preview} name={file.name} kind={file.kind} fallback="This file type can't be shown here. Download it to open it." />;
}

/** An image can become the event's cover; the current cover can go back to the drawn one. */
function CoverButton({ file, vm }: { file: PmcmLibraryFile; vm: PmcmFileLibraryViewModel }) {
  const busy = vm.busy !== null;
  if (vm.coverObjectId === file.id) {
    return (
      <Button type="button" variant="outline" disabled={busy} onClick={() => void vm.removeCover(file)}>
        <ImageOff className="size-4" />
        Remove as event cover
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void vm.makeCover(file)}>
      <ImageIcon className="size-4" />
      Use as event cover
    </Button>
  );
}

function PreviewActions({ file, vm }: { file: PmcmLibraryFile; vm: PmcmFileLibraryViewModel }) {
  const busy = vm.busy !== null;
  const review = file.review;
  return (
    <>
      {review ? (
        <>
          <Button type="button" disabled={busy} onClick={() => void vm.review(review, "approve")}>Approve</Button>
          <PmcmRejectForm fileName={file.name} disabled={busy} onReject={(reason) => void vm.review(review, "reject", reason)} />
        </>
      ) : null}
      <Button type="button" variant={review ? "outline" : "default"} disabled={busy} onClick={() => void vm.download(file.id)}>
        <Download className="size-4" />
        Download
      </Button>
      {file.kind === "image" ? <CoverButton file={file} vm={vm} /> : null}
      {file.deletable && vm.coverObjectId !== file.id ? <PmcmDeleteFileButton fileName={file.name} disabled={busy} onDelete={() => void vm.remove(file)} /> : null}
    </>
  );
}

/** A file opened from the library, in the panel every portal shares, with PMCM's decision and the cover choice. */
export function PmcmFilePreviewSheet({ vm }: { vm: PmcmFileLibraryViewModel }) {
  const file = vm.preview;
  if (!file) return <FilePreviewSheet open={false} onClose={vm.closePreview} kind="other" name="" tall={false} frame={null} />;
  return (
    <FilePreviewSheet
      open
      onClose={vm.closePreview}
      kind={file.kind}
      name={file.name}
      meta={[`From ${file.from}`, formatPortalDateTime(file.addedAt), formatFileSize(file.size)].filter(Boolean).join(" · ")}
      tall={file.kind === "pdf" || file.kind === "image"}
      frame={<PreviewFrame key={file.id} file={file} />}
      footer={<PreviewActions file={file} vm={vm} />}
    >
      <FileReviewNote lead="Rejected:" reason={file.reviewReason} />
      <dl className="divide-y divide-border">
        <FileDetail label="Status"><span className={FILE_TONE[file.tone]}>{file.status}</span></FileDetail>
        {file.label ? <FileDetail label="Sent for">{file.label}</FileDetail> : null}
        <FileValidUntil
          key={`${file.id}:${file.expiresAt ?? ""}`}
          fileName={file.name}
          expiresAt={file.expiresAt}
          editable
          busy={vm.busy !== null}
          onSave={(value) => void vm.setExpiry(file, value)}
        />
      </dl>
    </FilePreviewSheet>
  );
}
