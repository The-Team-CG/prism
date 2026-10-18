"use client";

import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import type { PrismStoredObject } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useClientStoredFilesViewModel } from "../view-models/use-client-stored-files-view-model";

const ACCEPTED_FILES = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

function displaySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayUsage(object: PrismStoredObject) {
  if (object.usage === "event_deliverable") return "Shared by PMCM";
  if (object.usage === "signed_conforme") return "Conforme";
  return "Your upload";
}

export function ClientStoredFilesPanel({ eventId }: { eventId?: string }) {
  const model = useClientStoredFilesViewModel(eventId);
  if (!eventId) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-foreground">Event files</h2>
          <p className="mt-1 text-xs text-muted-foreground">Upload documents for PMCM and download files shared with you.</p>
        </div>
        <div>
          <input
            ref={model.inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPTED_FILES}
            onChange={(event) => void model.uploadSelectedFile(event.currentTarget.files?.[0])}
            disabled={model.busy}
          />
          <button
            type="button"
            onClick={() => model.inputRef.current?.click()}
            disabled={model.busy}
            className="inline-flex items-center gap-2 rounded-lg bg-(--prism-signal) px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {model.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {model.busy ? "Uploading" : "Upload file"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PDF, Word, Excel, JPG, or PNG · up to 25 MB</p>
      {model.error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{model.error}</p>}
      {model.files.length === 0 ? (
        <div className="mt-4"><EmptyState icon={FileText} title="No files yet" description="Your uploads and PMCM-shared files will appear here." /></div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {model.files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-(--prism-signal)"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{file.originalFileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{displayUsage(file)} · {displaySize(file.declaredByteSize)} · {file.lifecycleState === "stored" ? "Available" : file.lifecycleState}</p>
              </div>
              {file.lifecycleState === "stored" && (
                <button
                  type="button"
                  onClick={() => void model.downloadFile(file.id)}
                  disabled={model.activeDownload !== null}
                  aria-label={`Download ${file.originalFileName}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {model.activeDownload === file.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
