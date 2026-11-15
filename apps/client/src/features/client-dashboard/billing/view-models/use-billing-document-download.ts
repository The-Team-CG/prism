"use client";

import { useState } from "react";
import type { PrismFile } from "@prism/api-client";

function save(file: PrismFile) {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download one billing document at a time, saying which is preparing and why one failed. */
export function useBillingDocumentDownload() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function download(key: string, fetchFile: () => Promise<PrismFile>) {
    setBusyKey(key);
    setError(null);
    try {
      save(await fetchFile());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the document.");
    } finally {
      setBusyKey(null);
    }
  }
  return { busyKey, error, download };
}

export type BillingDocumentDownload = ReturnType<typeof useBillingDocumentDownload>;
