"use client";

import { useEffect, useState } from "react";
import { pmcmDocumentRepository } from "../data/pmcm-document-repository";
import type { PmcmLibraryFile } from "../model/pmcm-file-library";

export type PmcmFilePreview =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; url: string; kind: "pdf" | "image" }
  | { status: "error"; message: string };

/** Browsers show PDFs and images inline; other files get a details card and a download instead. */
export function pmcmFileHasPreview(file: Pick<PmcmLibraryFile, "kind">) {
  return file.kind === "pdf" || file.kind === "image";
}

/**
 * Loads a previewable file into a local object URL. The blob is re-typed from the stored metadata, so a file is only
 * shown as the PDF or image it was stored as, and the URL is released when the preview changes.
 */
export function usePmcmFilePreview(file: PmcmLibraryFile | null): PmcmFilePreview {
  const [preview, setPreview] = useState<PmcmFilePreview>({ status: "none" });
  const objectId = file && pmcmFileHasPreview(file) ? file.id : null;
  const kind = file?.kind === "pdf" ? "pdf" : "image";
  const imageType = file?.contentType.startsWith("image/") ? file.contentType : "image/png";

  useEffect(() => {
    if (!objectId) {
      setPreview({ status: "none" });
      return;
    }
    let active = true;
    let url: string | null = null;
    setPreview({ status: "loading" });
    pmcmDocumentRepository.download(objectId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(new Blob([blob], { type: kind === "pdf" ? "application/pdf" : imageType }));
        setPreview({ status: "ready", url, kind });
      })
      .catch((reason) => {
        if (active) setPreview({ status: "error", message: reason instanceof Error ? reason.message : "This file couldn't be loaded." });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [objectId, kind, imageType]);

  return preview;
}
