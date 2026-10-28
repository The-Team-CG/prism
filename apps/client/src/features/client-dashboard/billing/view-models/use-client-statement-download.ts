"use client";

import { useState } from "react";
import { clientStoredFilesRepository } from "../../files/data/client-stored-files-repository";

export function useClientStatementDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(objectId?: string | null, fileName = "billing-statement.pdf") {
    if (!objectId) return;
    setBusy(true);
    setError("");
    try {
      const file = await clientStoredFilesRepository.download(objectId);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName || fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download the billing statement.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, download };
}
