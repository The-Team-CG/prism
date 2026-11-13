"use client";

import { useMemo, useRef, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { selectClientEventHistoryEvents, useClientWorkspace } from "../../workspace/shared";
import { isPastClientEvent, orderClientEvents } from "../../home/model/client-home-summary";
import { clientEventFileRequirements, clientEventStoredFiles } from "../data/client-file-library-resources";
import { buildClientDocumentChecklist } from "../model/client-document-checklist";
import {
  buildClientFileLibrary,
  clientFileFilterForView,
  countClientFiles,
  filterClientLibrary,
  sortClientLibrary,
  type ClientFileFilter,
  type ClientFileSort,
} from "../model/client-file-library";
import { downloadClientStoredFile, uploadClientStoredFile } from "../use-cases/client-stored-file-actions";
import { saveDownload } from "./save-download";

/**
 * The client's file library: every event (upcoming first, then past for later reference), and for the chosen
 * one what PMCM still needs from the client above all of its files on fixed shelves.
 */
export function useClientFileLibraryViewModel() {
  const { state, session, portalView } = useClientWorkspace();
  const events = useMemo(() => orderClientEvents(selectClientEventHistoryEvents(state, session)), [state, session]);
  const [chosenEventId, setChosenEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClientFileFilter>(() => clientFileFilterForView(portalView));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [sort, setSort] = useState<ClientFileSort>({ key: "date", direction: "desc" });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRequirement = useRef<string | undefined>(undefined);
  const uploadAttempts = useRef(new Map<string, string>());
  const invalidate = useInvalidate();

  const event = events.find((entry) => entry.id === chosenEventId) ?? events[0];
  const eventId = event?.id ?? null;
  const objects = useResource(clientEventStoredFiles, eventId);
  const requirements = useResource(clientEventFileRequirements, eventId);

  const documents = useMemo(() => (state?.documents ?? []).filter((document) => document.eventId === eventId), [state, eventId]);
  const files = useMemo(
    () => buildClientFileLibrary(objects.data ?? [], documents, requirements.data?.items ?? []),
    [objects.data, documents, requirements.data],
  );
  const needed = useMemo(
    () => buildClientDocumentChecklist(requirements.data?.items ?? [], objects.data ?? []).rows.filter((row) => row.needsClient),
    [requirements.data, objects.data],
  );

  const visibleFiles = useMemo(() => sortClientLibrary(filterClientLibrary(files, filter, query), sort), [files, filter, query, sort]);

  function chooseEvent(id: string) {
    setChosenEventId(id);
    setPreviewId(null);
    setQuery("");
    setError(null);
    setNotice(null);
  }

  function startUpload(requirementKey?: string) {
    pendingRequirement.current = requirementKey;
    if (!inputRef.current) return;
    inputRef.current.multiple = !requirementKey;
    inputRef.current.click();
  }

  /**
   * Sends files one at a time so each keeps its own retry identity. A requirement takes one file (the newest
   * upload is the one PMCM reviews); general uploads take several.
   */
  async function uploadFiles(selected: File[], requirementKey?: string) {
    const files = requirementKey ? selected.slice(0, 1) : selected;
    if (files.length === 0 || !eventId || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const sent: string[] = [];
    const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length, current: file.name });
      const fileKey = `${eventId}:${requirementKey ?? ""}:${file.name}:${file.size}:${file.lastModified}`;
      const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
      uploadAttempts.current.set(fileKey, attemptId);
      try {
        await uploadClientStoredFile(file, eventId, attemptId, requirementKey);
        uploadAttempts.current.delete(fileKey);
        sent.push(file.name);
      } catch (reason) {
        failed.push(`${file.name} (${reason instanceof Error ? reason.message : "upload failed"})`);
      }
    }
    setProgress(null);
    if (failed.length) setError(`Couldn't upload ${failed.join("; ")}.`);
    if (sent.length) {
      const label = requirements.data?.items.find((item) => item.key === requirementKey)?.label;
      const where = event?.eventName ?? "this event";
      setNotice(label ? `${sent[0]} sent for ${label}. PMCM will review it.` : sent.length === 1 ? `${sent[0]} added to ${where}.` : `${sent.length} files added to ${where}.`);
      await Promise.all([invalidate(clientEventStoredFiles, eventId), invalidate(clientEventFileRequirements, eventId)]);
    }
    setBusy(false);
  }

  /** Files chosen in the picker go to the requirement whose button opened it, if any. */
  function uploadPicked(list: FileList | null | undefined) {
    const requirementKey = pendingRequirement.current;
    pendingRequirement.current = undefined;
    void uploadFiles(Array.from(list ?? []), requirementKey);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadFile(objectId: string) {
    setActiveDownload(objectId);
    setError(null);
    try {
      saveDownload(await downloadClientStoredFile(objectId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to download this file.");
    } finally {
      setActiveDownload(null);
    }
  }

  return {
    events,
    upcomingEvents: events.filter((entry) => !isPastClientEvent(entry)),
    pastEvents: events.filter(isPastClientEvent),
    event,
    chooseEvent,
    filter,
    setFilter,
    query,
    setQuery,
    counts: countClientFiles(files),
    files: visibleFiles,
    sort,
    toggleSort: (key: ClientFileSort["key"]) => setSort((current) => ({ key, direction: current.key === key ? (current.direction === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" })),
    preview: visibleFiles.find((file) => file.id === previewId) ?? null,
    openPreview: setPreviewId,
    closePreview: () => setPreviewId(null),
    stepPreview: (offset: 1 | -1) => {
      const index = visibleFiles.findIndex((file) => file.id === previewId);
      const next = visibleFiles[index + offset];
      if (index >= 0 && next) setPreviewId(next.id);
    },
    hasFiles: files.length > 0,
    filesLoading: objects.status === "pending",
    needed,
    neededLoading: requirements.status === "pending",
    loadError: objects.error?.message ?? requirements.error?.message ?? null,
    canUpload: Boolean(event && !event.archived),
    inputRef,
    startUpload,
    uploadFiles,
    uploadPicked,
    downloadFile,
    busy,
    progress,
    activeDownload,
    error,
    notice,
  };
}

export type ClientFileLibraryViewModel = ReturnType<typeof useClientFileLibraryViewModel>;
