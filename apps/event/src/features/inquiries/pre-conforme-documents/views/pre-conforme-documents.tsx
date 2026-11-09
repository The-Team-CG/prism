"use client";

import { useCallback, useEffect, useState } from "react";
import { EVENT_FILE_CATEGORIES, eventFileCategoryOf, type PrismStoredObject } from "@prism/types";
import { PRE_CONFORME_CATEGORIES, preConformeDocumentsRepository, type PreConformeCategory } from "../data/pre-conforme-documents-repository";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

/** FR-54: PMCM attaches NDAs and other required documents to an inquiry before the conforme; they stay PMCM-only. */
export function PreConformeDocuments({ inquiryId, conformeSigned }: { inquiryId: string; conformeSigned: boolean }) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PrismStoredObject[]>([]);
  const [category, setCategory] = useState<PreConformeCategory>("nda");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    try { setDocuments(await preConformeDocumentsRepository.list(id)); } catch { setDocuments([]); }
  }, []);

  useEffect(() => {
    setEventId(null);
    setDocuments([]);
    void preConformeDocumentsRepository.existingWorkspace(inquiryId).then(({ eventId: id }) => {
      if (!id) return;
      setEventId(id);
      void load(id);
    }).catch(() => undefined);
  }, [inquiryId, load]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const id = eventId ?? (await preConformeDocumentsRepository.workspace(inquiryId)).eventId;
      setEventId(id);
      await preConformeDocumentsRepository.upload(file, id, category);
      await load(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach the document.");
    } finally {
      setBusy(false);
    }
  }

  async function open(objectId: string) {
    const download = await preConformeDocumentsRepository.download(objectId);
    const url = URL.createObjectURL(download.blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (conformeSigned) return null;
  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
      <p className="font-semibold text-foreground">Pre-conforme documents</p>
      {documents.length === 0 ? <p className="text-muted-foreground">None attached.</p> : null}
      <ul className="space-y-1">
        {documents.map((document) => (
          <li key={document.id}><button type="button" onClick={() => void open(document.id)} className="font-semibold text-primary">{document.originalFileName}</button> · {EVENT_FILE_CATEGORIES[eventFileCategoryOf(document.logicalTarget)]}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="mt-1 grid gap-1">
          <span>Type</span>
          <Select value={category} onValueChange={(value) => { const next = PRE_CONFORME_CATEGORIES.find((candidate) => candidate === value); if (next) setCategory(next); }}>
            <SelectTrigger aria-label="Document type" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRE_CONFORME_CATEGORIES.map((value) => <SelectItem key={value} value={value}>{EVENT_FILE_CATEGORIES[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label>Attach<input type="file" disabled={busy} onChange={(event) => void upload(event.currentTarget.files?.[0])} className="mt-1 block text-xs" /></label>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    </div>
  );
}
