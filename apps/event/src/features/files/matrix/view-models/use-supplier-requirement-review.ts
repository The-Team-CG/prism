"use client";

import { useState } from "react";
import { parseContract, reviewSupplierRequirementSchema } from "@prism/types";
import { fileRequirementsMatrixRepository } from "../data/file-requirements-matrix-repository";

export function useSupplierRequirementReview(eventId: string | undefined, reload: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function review(key: string, documentId: string, decision: "approve" | "reject", reason: string) {
    if (!eventId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input = parseContract(reviewSupplierRequirementSchema, { documentId, decision, reason }, "Review");
      await fileRequirementsMatrixRepository.review(eventId, key, input);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the review.");
    } finally {
      setBusy(false);
    }
  }
  async function download(objectId: string) {
    setError(null);
    try {
      const file = await fileRequirementsMatrixRepository.download(objectId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to download the supplier file.");
    }
  }
  return { busy, error, review, download };
}
