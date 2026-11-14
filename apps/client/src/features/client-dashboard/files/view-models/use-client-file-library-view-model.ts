"use client";

import { useMemo, useRef, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { selectClientEventHistoryEvents, useClientWorkspace } from "../../workspace/shared";
import { isPastClientEvent, orderClientEvents } from "../../home/model/client-home-summary";
import { clientEventFileRequirements, clientEventStoredFiles } from "../data/client-file-library-resources";
import { buildClientDocumentChecklist } from "../model/client-document-checklist";
import {
  buildClientFileLibrary,
  CLIENT_ARCHIVE_WARNING_BYTES,
  clientArchiveEntries,
  clientArchiveTotalBytes,
  clientFileFilterForView,
  countClientFiles,
  filterClientLibrary,
  isNewClientFile,
  sortClientLibrary,
  type ClientFileFilter,
  type ClientFileSort,
  type ClientLibraryFile,
} from "../model/client-file-library";
import { buildClientEventArchive, reuseClientStoredFile } from "../use-cases/client-file-archive";
import { downloadClientStoredFile, uploadClientStoredFile } from "../use-cases/client-stored-file-actions";
import { saveDownload } from "./save-download";
import { useClientAccountFiles } from "./use-client-account-files";
import { useClientFilesLastSeen } from "./use-client-files-last-seen";

function uploadNotice(sent: string[], requirementLabel: string | undefined, eventName = "this event") {
  if (requirementLabel) return `${sent[0]} sent for ${requirementLabel}. PMCM will review it.`;
  return sent.length === 1 ? `${sent[0]} added to ${eventName}.` : `${sent.length} files added to ${eventName}.`;
}

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
  const [searchAll, setSearchAll] = useState(false);
  const [reuseTarget, setReuseTarget] = useState<{ key: string; label: string } | null>(null);
  const [reuseQuery, setReuseQuery] = useState("");
  const [archiving, setArchiving] = useState<{ done: number; total: number } | null>(null);
  const [archiveWarning, setArchiveWarning] = useState<{ totalBytes: number; largest: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRequirement = useRef<string | undefined>(undefined);
  const uploadAttempts = useRef(new Map<string, string>());
  const invalidate = useInvalidate();

  const event = events.find((entry) => entry.id === chosenEventId) ?? events[0];
  const eventId = event?.id ?? null;
  const objects = useResource(clientEventStoredFiles, eventId);
  const requirements = useResource(clientEventFileRequirements, eventId);

  const lastSeen = useClientFilesLastSeen(session?.id, eventId);
  const allDocuments = useMemo(() => state?.documents ?? [], [state]);
  const documents = useMemo(() => allDocuments.filter((document) => document.eventId === eventId), [allDocuments, eventId]);
  const files = useMemo(
    () => buildClientFileLibrary(objects.data ?? [], documents, requirements.data?.items ?? []).map((file) => ({ ...file, isNew: isNewClientFile(file, lastSeen) })),
    [objects.data, documents, requirements.data, lastSeen],
  );
  const accountSearch = useClientAccountFiles(searchAll && query.trim() ? query : null, events);
  const reuseSearch = useClientAccountFiles(reuseTarget ? reuseQuery : null, events);
  const reuseCandidates = useMemo(() => reuseSearch.files.filter((file) => file.eventId !== eventId && file.objectId), [reuseSearch.files, eventId]);
  const needed = useMemo(
    () => buildClientDocumentChecklist(requirements.data?.items ?? [], objects.data ?? []).rows.filter((row) => row.needsClient),
    [requirements.data, objects.data],
  );

  const visibleFiles = useMemo(() => sortClientLibrary(filterClientLibrary(files, filter, query), sort), [files, filter, query, sort]);

  function chooseEvent(id: string) {
    setChosenEventId(id);
    setArchiveWarning(null);
    setPreviewId(null);
    setSearchAll(false);
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

  /** Uploads one file, reusing its retry identity after a failure; returns why it failed, if it did. */
  async function uploadOne(file: File, targetEventId: string, requirementKey: string | undefined) {
    const fileKey = `${targetEventId}:${requirementKey ?? ""}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    try {
      await uploadClientStoredFile(file, targetEventId, attemptId, requirementKey);
      uploadAttempts.current.delete(fileKey);
      return null;
    } catch (reason) {
      return `${file.name} (${reason instanceof Error ? reason.message : "upload failed"})`;
    }
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
      const failure = await uploadOne(file, eventId, requirementKey);
      if (failure) failed.push(failure);
      else sent.push(file.name);
    }
    setProgress(null);
    if (failed.length) setError(`Couldn't upload ${failed.join("; ")}.`);
    if (sent.length) {
      const label = requirements.data?.items.find((item) => item.key === requirementKey)?.label;
      setNotice(uploadNotice(sent, label, event?.eventName));
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

  /** Opens an account-wide search result in its own event, with its preview. */
  function openSearchResult(file: ClientLibraryFile) {
    if (!file.eventId) return;
    chooseEvent(file.eventId);
    setFilter("all");
    setPreviewId(file.id);
  }

  /** Sends a copy of a file from another event for one of this event's requirements. */
  async function reuseFile(source: ClientLibraryFile) {
    const target = reuseTarget;
    setReuseTarget(null);
    if (!eventId || !target || !source.objectId || busy) return;
    const attemptKey = `${eventId}:${target.key}:reuse:${source.objectId}`;
    const attemptId = uploadAttempts.current.get(attemptKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(attemptKey, attemptId);
    setBusy(true);
    setError(null);
    setNotice(null);
    setProgress({ done: 0, total: 1, current: source.name });
    try {
      await reuseClientStoredFile(source.objectId, eventId, attemptId, target.key);
      uploadAttempts.current.delete(attemptKey);
      setNotice(`${source.name} from ${source.eventName ?? "another event"} sent for ${target.label}. PMCM will review it.`);
      await Promise.all([invalidate(clientEventStoredFiles, eventId), invalidate(clientEventFileRequirements, eventId)]);
    } catch (reason) {
      setError(`Couldn't reuse ${source.name} (${reason instanceof Error ? reason.message : "copy failed"}).`);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  /** Every downloadable file of this event in one ZIP, a folder per shelf; a very large set asks first. */
  async function downloadAll(confirmed = false) {
    const entries = clientArchiveEntries(files);
    if (entries.length === 0 || archiving) return;
    const totalBytes = clientArchiveTotalBytes(entries);
    if (!confirmed && totalBytes > CLIENT_ARCHIVE_WARNING_BYTES) {
      setArchiveWarning({ totalBytes, largest: [...entries].sort((left, right) => right.size - left.size).slice(0, 3).map((entry) => entry.name) });
      return;
    }
    setArchiveWarning(null);
    setError(null);
    setArchiving({ done: 0, total: entries.length });
    try {
      const { blob, failed } = await buildClientEventArchive(entries, (done, total) => setArchiving({ done, total }));
      saveDownload({ blob, fileName: `${(event?.eventName ?? "Event").replace(/[\\/:*?"<>|]/g, "-")} files.zip` });
      if (failed.length) setError(`The ZIP is missing ${failed.length === 1 ? "1 file" : `${failed.length} files`} that couldn't be downloaded: ${failed.join(", ")}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't build the ZIP.");
    } finally {
      setArchiving(null);
    }
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
    newCount: files.filter((file) => file.isNew).length,
    downloadableCount: clientArchiveEntries(files).length,
    downloadAll,
    archiving,
    archiveWarning,
    dismissArchiveWarning: () => setArchiveWarning(null),
    searchAll,
    setSearchAll,
    accountResults: accountSearch.files,
    accountLoading: accountSearch.loading,
    openSearchResult,
    reuseTarget,
    openReuse: (key: string, label: string) => { setReuseQuery(""); setReuseTarget({ key, label }); },
    closeReuse: () => setReuseTarget(null),
    reuseQuery,
    setReuseQuery,
    reuseCandidates,
    reuseLoading: reuseSearch.loading,
    reuseFile,
    filesLoading: objects.status === "pending",
    needed,
    neededLoading: requirements.status === "pending",
    loadError: objects.error?.message ?? requirements.error?.message ?? accountSearch.error ?? reuseSearch.error ?? null,
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
