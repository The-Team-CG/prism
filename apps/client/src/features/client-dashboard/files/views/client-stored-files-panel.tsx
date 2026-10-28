"use client";

import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import type { PrismStoredObject } from "@prism/types";
import { useState } from "react";
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
  const [requirementKey, setRequirementKey] = useState("");
  if (!eventId) return null;

  return (
    <section id="event-files" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Uploads and shared files</h2>
          <p className="mt-1 text-sm text-muted-foreground">Send a file to PMCM or download a file shared with you. Uploading a file does not approve it.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {model.requirements.length > 0 ? (
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Fulfil a requirement
              <select aria-label="Requirement to fulfil" value={requirementKey} onChange={(event) => setRequirementKey(event.target.value)} className="max-w-64 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="">Upload without binding</option>
                {model.requirements.map((requirement) => <option key={requirement.key} value={requirement.key}>{requirement.label}</option>)}
              </select>
            </label>
          ) : null}
          <input
            ref={model.inputRef}
            className="sr-only"
            type="file"
            aria-label="Choose a document to upload for this event"
            accept={ACCEPTED_FILES}
            onChange={(event) => void model.uploadSelectedFile(event.currentTarget.files?.[0], requirementKey || undefined)}
            disabled={model.busy}
          />
          <button
            type="button"
            onClick={() => model.inputRef.current?.click()}
            disabled={model.busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {model.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {model.busy ? "Uploading" : "Upload file"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PDF, Word, Excel, JPG, or PNG · up to 25 MB</p>
      {model.error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{model.error}</p>}
      {model.notice ? <p role="status" className="mt-3 text-sm text-success">{model.notice}</p> : null}
      {model.loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading event files…</p> : model.files.length === 0 ? (
        !model.error ? <p className="mt-4 rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">No files have been shared yet. Use Upload file to send a requested document to PMCM.</p> : null
      ) : (
        <div className="mt-4 divide-y divide-border">
          {model.files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileText className="size-4" /></span>
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
