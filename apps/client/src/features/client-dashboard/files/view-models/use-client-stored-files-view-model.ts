"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismStoredObject } from "@prism/types";
import { clientStoredFilesRepository } from "../data/client-stored-files-repository";

function saveDownload(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function useClientStoredFilesViewModel(eventId?: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeEventIdRef = useRef(eventId);
  const uploadAttempts = useRef(new Map<string, string>());
  activeEventIdRef.current = eventId;
  const [files, setFiles] = useState<PrismStoredObject[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));

  async function refresh(forEventId: string) {
    const result = await clientStoredFilesRepository.list(forEventId);
    if (activeEventIdRef.current === forEventId) setFiles(result.filter((file) => file.lifecycleState !== "deleted"));
  }

  useEffect(() => {
    let active = true;
    setFiles([]);
    setError(null);
    setNotice(null);
    setLoading(Boolean(eventId));
    setActiveDownload(null);
    if (!eventId) return () => { active = false; };
    clientStoredFilesRepository.list(eventId)
      .then((result) => { if (active) { setFiles(result.filter((file) => file.lifecycleState !== "deleted")); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load files."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  async function refreshAfterUpload(uploadEventId: string) {
    try {
      await refresh(uploadEventId);
    } catch {
      if (activeEventIdRef.current === uploadEventId) setError("Your file was uploaded, but the list could not refresh. Reload this page to see the updated files.");
    }
  }

  async function uploadSelectedFile(file?: File) {
    if (!file || !eventId) return;
    const uploadEventId = eventId;
    const fileKey = `${uploadEventId}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await clientStoredFilesRepository.upload(file, uploadEventId, "client_document", attemptId);
      if (activeEventIdRef.current === uploadEventId) setNotice(`${file.name} uploaded. PMCM can review it for this event.`);
      uploadAttempts.current.delete(fileKey);
      await refreshAfterUpload(uploadEventId);
    } catch (reason) {
      if (activeEventIdRef.current === uploadEventId) setError(reason instanceof Error ? reason.message : "Unable to upload this file.");
    } finally {
      if (activeEventIdRef.current === uploadEventId) setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function downloadFile(objectId: string) {
    const downloadEventId = eventId;
    setActiveDownload(objectId);
    setError(null);
    try {
      const file = await clientStoredFilesRepository.download(objectId);
      if (activeEventIdRef.current === downloadEventId) saveDownload(file);
    } catch (reason) {
      if (activeEventIdRef.current === downloadEventId) setError(reason instanceof Error ? reason.message : "Unable to download this file.");
    } finally {
      if (activeEventIdRef.current === downloadEventId) setActiveDownload(null);
    }
  }

  return { inputRef, files, busy, activeDownload, error, notice, loading, uploadSelectedFile, downloadFile };
}
