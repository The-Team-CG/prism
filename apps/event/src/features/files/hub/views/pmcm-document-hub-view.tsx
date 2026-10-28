"use client";

import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { storedDocumentMetadataLine } from "../model/stored-document-labels";
import { usePmcmDocumentHubViewModel } from "../view-models/use-pmcm-document-hub-view-model";

export function PmcmDocumentHubView({ eventId }: { eventId: string }) {
  const model = usePmcmDocumentHubViewModel(eventId);

  return (
    <section aria-label="PMCM event file hub" className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-foreground">Stored event files</h2>
          <p className="mt-1 text-xs text-muted-foreground">Files shared with clients are available in their event workspace after upload completes.</p>
        </div>
        <div>
          <input ref={model.inputRef} type="file" className="sr-only" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4,.mov" onChange={(event) => void model.upload(event.currentTarget.files?.[0])} disabled={model.busy} />
          <button type="button" onClick={() => model.inputRef.current?.click()} disabled={model.busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {model.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {model.busy ? "Uploading" : "Upload deliverable"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PDF, Word, Excel, JPG, PNG, MP4, or MOV · up to 250 MB</p>
      {model.error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{model.error}</p>}
      {model.documents.length === 0 ? (
        <div className="mt-4"><EmptyState icon={FileText} title="No stored files yet" description="Upload a deliverable to share it with the client." /></div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {model.documents.map((document) => (
            <div key={document.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{document.originalFileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{storedDocumentMetadataLine(document)}</p>
              </div>
              {document.lifecycleState === "stored" && (
                <button type="button" aria-label={`Download ${document.originalFileName}`} onClick={() => void model.download(document.id)} disabled={model.downloading !== null} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                  {model.downloading === document.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
