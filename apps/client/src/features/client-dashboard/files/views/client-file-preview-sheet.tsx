"use client";

import Link from "next/link";
import { Download, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { FILE_TONE, FileDetail, FilePreviewFrame, FilePreviewSheet, FileReviewNote, FileValidUntil, formatFileSize } from "@prism/ui/file-library";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { CLIENT_FILE_CATEGORIES, type ClientLibraryFile } from "../model/client-file-library";
import { clientFileHasPreview, useClientFilePreview } from "../view-models/use-client-file-preview";
import type { ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";

function PreviewFrame({ file }: { file: ClientLibraryFile }) {
  const preview = useClientFilePreview(file);
  const fallback = file.objectId ? "This file type can't be shown here. Download it to open it." : "PMCM keeps this record in the event workspace.";
  return <FilePreviewFrame state={preview} name={file.name} kind={file.kind} fallback={fallback} />;
}

function PreviewDetails({ file, vm }: { file: ClientLibraryFile; vm: ClientFileLibraryViewModel }) {
  return (
    <>
      <FileReviewNote reason={file.reviewReason} />
      <dl className="divide-y divide-border">
        <FileDetail label="Status"><span className={FILE_TONE[file.tone]}>{file.status}</span></FileDetail>
        {file.requirementLabel ? <FileDetail label="Sent for">{file.requirementLabel}</FileDetail> : null}
        <FileDetail label="Category">{CLIENT_FILE_CATEGORIES.find((category) => category.id === file.category)?.label ?? "Other"}</FileDetail>
        <FileValidUntil
          key={`${file.id}:${file.expiresAt ?? ""}`}
          fileName={file.name}
          expiresAt={file.expiresAt}
          editable={file.addedBy === "You" && Boolean(file.objectId)}
          busy={vm.busy}
          onSave={(value) => void vm.setExpiry(file, value)}
        />
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
    <>
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
    </>
  );
}

/**
 * A file opened from the library, in the panel every portal shares: the file itself when the browser can show it,
 * then what it is for, its review state and PMCM's reason, earlier versions, and the actions that apply.
 */
export function ClientFilePreviewSheet({ vm, eventId }: { vm: ClientFileLibraryViewModel; eventId: string }) {
  const file = vm.preview;
  const index = file ? vm.files.findIndex((entry) => entry.id === file.id) : -1;
  if (!file) return <FilePreviewSheet open={false} onClose={vm.closePreview} kind="other" name="" tall={false} frame={null} />;
  const meta = [file.addedBy === "You" ? "Added by you" : `Added by ${file.addedBy}`, file.addedAt ? formatPortalDate(file.addedAt) : null, formatFileSize(file.size)];
  return (
    <FilePreviewSheet
      open
      onClose={vm.closePreview}
      kind={file.kind}
      name={file.name}
      meta={meta.filter(Boolean).join(" · ")}
      onStep={vm.stepPreview}
      canStep={{ previous: index > 0, next: index >= 0 && index < vm.files.length - 1 }}
      tall={clientFileHasPreview(file)}
      frame={<PreviewFrame key={file.id} file={file} />}
      footer={<PreviewActions file={file} vm={vm} eventId={eventId} />}
    >
      <PreviewDetails file={file} vm={vm} />
      <PreviewVersions file={file} vm={vm} />
    </FilePreviewSheet>
  );
}
