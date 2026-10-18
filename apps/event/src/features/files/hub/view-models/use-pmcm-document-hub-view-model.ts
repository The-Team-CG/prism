"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismStoredObject } from "@prism/types";
import { pmcmDocumentRepository } from "../data/pmcm-document-repository";

function saveFile(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function usePmcmDocumentHubViewModel(eventId: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeEventId = useRef(eventId);
  const uploadAttempts = useRef(new Map<string, string>());
  activeEventId.current = eventId;
  const [documents, setDocuments] = useState<PrismStoredObject[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(forEventId: string) {
    const files = await pmcmDocumentRepository.list(forEventId);
    if (activeEventId.current === forEventId) setDocuments(files.filter((file) => file.lifecycleState !== "deleted"));
  }

  useEffect(() => {
    let active = true;
    setDocuments([]);
    setError(null);
    setDownloading(null);
    pmcmDocumentRepository.list(eventId)
      .then((files) => { if (active) { setDocuments(files.filter((file) => file.lifecycleState !== "deleted")); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load the event file hub."); });
    return () => { active = false; };
  }, [eventId]);

  async function upload(file?: File) {
    if (!file) return;
    const uploadEventId = eventId;
    const fileKey = `${uploadEventId}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    setBusy(true);
    setError(null);
    try {
      await pmcmDocumentRepository.upload(file, uploadEventId, attemptId);
      await refresh(uploadEventId);
      uploadAttempts.current.delete(fileKey);
    } catch (reason) {
      if (activeEventId.current === uploadEventId) setError(reason instanceof Error ? reason.message : "Unable to upload this file.");
    } finally {
      if (activeEventId.current === uploadEventId) setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(objectId: string) {
    const downloadEventId = eventId;
    setDownloading(objectId);
    setError(null);
    try {
      const file = await pmcmDocumentRepository.download(objectId);
      if (activeEventId.current === downloadEventId) saveFile(file);
    } catch (reason) {
      if (activeEventId.current === downloadEventId) setError(reason instanceof Error ? reason.message : "Unable to download this file.");
    } finally {
      if (activeEventId.current === downloadEventId) setDownloading(null);
    }
  }

  return { inputRef, documents, busy, downloading, error, upload, download };
}
