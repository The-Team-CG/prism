"use client";

import { useMemo, useRef, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { selectClientEventHistoryEvents, useClientWorkspace } from "../../workspace/shared";
import { isPastClientEvent, orderClientEvents } from "../../home/model/client-home-summary";
import { clientEventFileRequirements, clientEventStoredFiles } from "../data/client-file-library-resources";
import { buildClientDocumentChecklist } from "../model/client-document-checklist";
import { buildClientFileLibrary, clientFileFilterForView, countClientFiles, filterClientLibrary, type ClientFileFilter } from "../model/client-file-library";
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

  function chooseEvent(id: string) {
    setChosenEventId(id);
    setQuery("");
    setError(null);
    setNotice(null);
  }

  function startUpload(requirementKey?: string) {
    pendingRequirement.current = requirementKey;
    inputRef.current?.click();
  }

  async function uploadSelectedFile(file: File | undefined) {
    if (!file || !eventId) return;
    const requirementKey = pendingRequirement.current;
    const fileKey = `${eventId}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await uploadClientStoredFile(file, eventId, attemptId, requirementKey);
      uploadAttempts.current.delete(fileKey);
      const label = requirements.data?.items.find((item) => item.key === requirementKey)?.label;
      setNotice(label ? `${file.name} sent for ${label}. PMCM will review it.` : `${file.name} added to ${event?.eventName ?? "this event"}.`);
      await Promise.all([invalidate(clientEventStoredFiles, eventId), invalidate(clientEventFileRequirements, eventId)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload this file.");
    } finally {
      setBusy(false);
      pendingRequirement.current = undefined;
      if (inputRef.current) inputRef.current.value = "";
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
    files: filterClientLibrary(files, filter, query),
    hasFiles: files.length > 0,
    filesLoading: objects.status === "pending",
    needed,
    neededLoading: requirements.status === "pending",
    loadError: objects.error?.message ?? requirements.error?.message ?? null,
    canUpload: Boolean(event && !event.archived),
    inputRef,
    startUpload,
    uploadSelectedFile,
    downloadFile,
    busy,
    activeDownload,
    error,
    notice,
  };
}

export type ClientFileLibraryViewModel = ReturnType<typeof useClientFileLibraryViewModel>;
