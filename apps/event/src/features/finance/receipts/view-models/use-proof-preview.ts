"use client";

import { useEffect, useState } from "react";
import type { PrismPaymentReceiptEvidence } from "@prism/types";
import { receiptsRepository } from "../data/receipts-repository";

export type ProofPreview =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; url: string; kind: "pdf" | "image" }
  | { status: "error"; message: string };

/**
 * Loads a receipt's proof of payment into a local object URL to show inline. The blob is re-typed from the stored
 * content type, so a file only shows as the PDF or image it was stored as, and the URL is released when the proof changes.
 */
export function useProofPreview(evidence: PrismPaymentReceiptEvidence | null): ProofPreview {
  const [preview, setPreview] = useState<ProofPreview>({ status: "none" });
  const objectId = evidence?.objectId ?? null;
  const contentType = evidence?.contentType ?? "";

  useEffect(() => {
    if (!objectId) {
      setPreview({ status: "none" });
      return;
    }
    let active = true;
    let url: string | null = null;
    setPreview({ status: "loading" });
    const kind = contentType === "application/pdf" ? "pdf" : "image";
    receiptsRepository.downloadEvidence(objectId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(new Blob([blob], { type: kind === "pdf" ? "application/pdf" : contentType || "image/png" }));
        setPreview({ status: "ready", url, kind });
      })
      .catch((reason: unknown) => {
        if (active) setPreview({ status: "error", message: reason instanceof Error ? reason.message : "The proof could not be loaded." });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [objectId, contentType]);

  return preview;
}
