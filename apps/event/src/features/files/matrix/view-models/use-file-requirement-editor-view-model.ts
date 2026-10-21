"use client";

import { useState } from "react";
import type { PrismFileRequirementItem } from "@prism/types";
import { createFileRequirement, updateFileRequirement } from "../use-cases/update-file-requirement";
import type { FileRequirementDraft } from "../model/file-requirements-matrix-rules";

export type FileRequirementEditTarget = { mode: "create" } | { mode: "edit"; item: PrismFileRequirementItem };

function describeSaveError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to save the file requirement.";
}

/** PMCM edit state for the matrix panel. `onSaved` reloads the matrix so derived status stays authoritative. */
export function useFileRequirementEditorViewModel(eventId: string | undefined, onSaved: () => Promise<void> | void) {
  const [target, setTarget] = useState<FileRequirementEditTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startCreate() {
    setSaveError(null);
    setTarget({ mode: "create" });
  }

  function startEdit(item: PrismFileRequirementItem) {
    setSaveError(null);
    setTarget({ mode: "edit", item });
  }

  function cancel() {
    setSaveError(null);
    setTarget(null);
  }

  async function save(draft: FileRequirementDraft) {
    if (!eventId || !target) return;
    setBusy(true);
    setSaveError(null);
    try {
      if (target.mode === "create") await createFileRequirement(eventId, draft);
      else await updateFileRequirement(eventId, target.item, draft);
      setTarget(null);
      await onSaved();
    } catch (error) {
      setSaveError(describeSaveError(error));
    } finally {
      setBusy(false);
    }
  }

  return {
    target,
    busy,
    saveError,
    startCreate,
    startEdit,
    cancel,
    save,
  };
}
