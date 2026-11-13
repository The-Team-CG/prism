"use client";

import { useMemo, useRef, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { EventFileCategory } from "@prism/types";
import { pmcmDocumentRepository } from "../data/pmcm-document-repository";
import { pmcmEventFileRequirements, pmcmEventStoredFiles } from "../data/pmcm-file-library-resources";
import { buildPmcmFileLibrary, countPmcmFiles, filterPmcmFiles, pmcmReviewQueue, type PmcmFileFilter, type PmcmReviewEntry } from "../model/pmcm-file-library";
import { approveRequirementFiles, reviewRequirementFile } from "../use-cases/review-requirement-files";

function saveFile(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

/** One event's file library for PMCM: what is waiting for review, every stored file, and PMCM's own uploads. */
export function usePmcmFileLibraryViewModel(eventId: string) {
  const invalidate = useInvalidate();
  const objects = useResource(pmcmEventStoredFiles, eventId);
  const matrix = useResource(pmcmEventFileRequirements, eventId);
  const [filter, setFilter] = useState<PmcmFileFilter>("all");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<EventFileCategory>("other");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAttempts = useRef(new Map<string, string>());

  const items = useMemo(() => matrix.data?.items ?? [], [matrix.data]);
  const library = useMemo(() => buildPmcmFileLibrary(objects.data ?? [], items), [objects.data, items]);
  const queue = useMemo(() => pmcmReviewQueue(items), [items]);
  const visibleFiles = useMemo(() => filterPmcmFiles(library.files, filter, query), [library.files, filter, query]);
  const preview = library.files.find((file) => file.id === previewId) ?? null;

  function refresh() {
    void invalidate(pmcmEventStoredFiles, eventId);
    void invalidate(pmcmEventFileRequirements, eventId);
  }

  async function run(label: string, work: () => Promise<string | null>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      setNotice(await work());
    } catch (reason) {
      setError(message(reason, "That didn't work. Try again."));
    } finally {
      setBusy(null);
      refresh();
    }
  }

  function review(entry: PmcmReviewEntry, decision: "approve" | "reject", reason = "") {
    return run(entry.documentId, async () => {
      await reviewRequirementFile(eventId, entry, decision, reason);
      setSelected((current) => new Set([...current].filter((id) => id !== entry.documentId)));
      return decision === "approve" ? `Approved ${entry.fileName}.` : `Rejected ${entry.fileName}. The sender was told why.`;
    });
  }

  function approveSelected() {
    const entries = queue.filter((entry) => selected.has(entry.documentId));
    return run("approve-selected", async () => {
      const failed = await approveRequirementFiles(eventId, entries);
      setSelected(new Set());
      const approved = entries.length - failed.length;
      return failed.length ? `Approved ${approved}. These changed and need another look: ${failed.join(", ")}.` : `Approved ${approved} file${approved === 1 ? "" : "s"}.`;
    });
  }

  function toggleSelected(documentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(documentId)) next.add(documentId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === queue.length ? new Set() : new Set(queue.map((entry) => entry.documentId))));
  }

  function upload(file?: File) {
    if (!file) return;
    const fileKey = `${eventId}:${category}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    return run("upload", async () => {
      try {
        await pmcmDocumentRepository.upload(file, eventId, category, attemptId);
        uploadAttempts.current.delete(fileKey);
        return `Shared ${file.name} with the client.`;
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function download(objectId: string) {
    return run(`download:${objectId}`, async () => {
      saveFile(await pmcmDocumentRepository.download(objectId));
      return null;
    });
  }

  const loadError = objects.error ?? matrix.error;
  return {
    loading: objects.status === "pending" || matrix.status === "pending",
    loadError: loadError ? message(loadError, "Unable to load this event's files.") : null,
    files: visibleFiles,
    unfinished: library.unfinished,
    counts: countPmcmFiles(library.files),
    queue,
    filter, setFilter,
    query, setQuery,
    preview, openPreview: setPreviewId, closePreview: () => setPreviewId(null),
    selected, toggleSelected, toggleAll, approveSelected,
    review, upload, download,
    busy, notice, error,
    category, setCategory, inputRef,
  };
}

export type PmcmFileLibraryViewModel = ReturnType<typeof usePmcmFileLibraryViewModel>;
