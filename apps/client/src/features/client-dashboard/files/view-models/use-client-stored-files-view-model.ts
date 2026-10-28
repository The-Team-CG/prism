"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismFileRequirementItem, PrismStoredObject } from "@prism/types";
import { downloadClientStoredFile, loadClientStoredFiles, uploadClientStoredFile } from "../use-cases/client-stored-file-actions";
import { isClientUploadableRequirement } from "../model/client-document-checklist";

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
  const [requirements, setRequirements] = useState<PrismFileRequirementItem[]>([]);
  const [allRequirements, setAllRequirements] = useState<PrismFileRequirementItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));

  useEffect(() => {
    let active = true;
    setFiles([]);
    setRequirements([]);
    setAllRequirements([]);
    setError(null);
    setNotice(null);
    setLoading(Boolean(eventId));
    setActiveDownload(null);
    if (!eventId) return () => { active = false; };
    loadClientStoredFiles(eventId)
      .then(([result, matrix]) => { if (active) { setFiles(result.filter((file) => file.lifecycleState !== "deleted")); setRequirements(clientOwnedOpenRequirements(matrix.items)); setAllRequirements(matrix.items); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load files."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  async function refreshAfterUpload(uploadEventId: string) {
    try {
      const [files, matrix] = await loadClientStoredFiles(uploadEventId);
      if (activeEventIdRef.current === uploadEventId) setFiles(files.filter((file) => file.lifecycleState !== "deleted"));
      if (activeEventIdRef.current === uploadEventId) {
        setRequirements(clientOwnedOpenRequirements(matrix.items));
        setAllRequirements(matrix.items);
      }
    } catch {
      if (activeEventIdRef.current === uploadEventId) setError("Your file was uploaded, but the list could not refresh. Reload this page to see the updated files.");
    }
  }

  async function uploadSelectedFile(file?: File, requirementKey?: string) {
    if (!file || !eventId) return;
    const uploadEventId = eventId;
    const fileKey = `${uploadEventId}:${file.name}:${file.size}:${file.lastModified}`;
    const attemptId = uploadAttempts.current.get(fileKey) ?? globalThis.crypto.randomUUID();
    uploadAttempts.current.set(fileKey, attemptId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await uploadClientStoredFile(file, uploadEventId, attemptId, requirementKey);
      if (activeEventIdRef.current === uploadEventId) setNotice(uploadSuccessMessage(file.name, requirementKey, allRequirements));
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
      const file = await downloadClientStoredFile(objectId);
      if (activeEventIdRef.current === downloadEventId) saveDownload(file);
    } catch (reason) {
      if (activeEventIdRef.current === downloadEventId) setError(reason instanceof Error ? reason.message : "Unable to download this file.");
    } finally {
      if (activeEventIdRef.current === downloadEventId) setActiveDownload(null);
    }
  }

  return { inputRef, files, requirements, allRequirements, busy, activeDownload, error, notice, loading, uploadSelectedFile, downloadFile };
}

function clientOwnedOpenRequirements(items: PrismFileRequirementItem[]) {
  return items.filter((item) => isClientUploadableRequirement(item) && !["submitted", "approved", "complete"].includes(item.status));
}

function uploadSuccessMessage(fileName: string, requirementKey: string | undefined, requirements: PrismFileRequirementItem[]) {
  if (!requirementKey) return `${fileName} uploaded. PMCM can review it for this event.`;
  const label = requirements.find((item) => item.key === requirementKey)?.label ?? requirementKey;
  return `${fileName} uploaded for ${label}.`;
}
