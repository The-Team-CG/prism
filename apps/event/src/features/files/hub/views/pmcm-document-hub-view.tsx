"use client";

import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { EVENT_FILE_CATEGORIES, eventFileCategoryOf, type EventFileCategory } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
            <span id="document-hub-file-type">File type</span>
            <Select value={model.category} onValueChange={(next) => model.setCategory(next as EventFileCategory)} disabled={model.busy}>
              <SelectTrigger aria-labelledby="document-hub-file-type" className="w-56 min-w-0 rounded-lg bg-background px-3 text-sm font-normal text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EVENT_FILE_CATEGORIES) as EventFileCategory[]).map((key) => <SelectItem key={key} value={key}>{EVENT_FILE_CATEGORIES[key]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <input ref={model.inputRef} type="file" className="sr-only" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4,.mov" onChange={(event) => void model.upload(event.currentTarget.files?.[0])} disabled={model.busy} />
          <Button type="button" onClick={() => model.inputRef.current?.click()} disabled={model.busy}>
            {model.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {model.busy ? "Uploading" : "Upload deliverable"}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PDF, Word, Excel, JPG, PNG, MP4, or MOV · up to 250 MB</p>
      {model.error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{model.error}</p>}
      {model.documents.length === 0 ? (
        <Empty className="mt-4 border-0 p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>No stored files yet</EmptyTitle>
            <EmptyDescription>Upload a deliverable to share it with the client.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {model.documents.map((document) => (
            <div key={document.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{document.originalFileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{EVENT_FILE_CATEGORIES[eventFileCategoryOf(document.logicalTarget)]} · {storedDocumentMetadataLine(document)}</p>
              </div>
              {document.lifecycleState === "stored" && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Download ${document.originalFileName}`} onClick={() => void model.download(document.id)} disabled={model.downloading !== null}>
                  {model.downloading === document.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
