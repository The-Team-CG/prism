"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Check, ChevronLeft, Eye, Layers3, LoaderCircle, Redo2, Send, TriangleAlert, Undo2 } from "lucide-react";
import { getHistoryCommandState, runRedo, runUndo, subscribeHistoryCommandState, type SaveStatus } from "@pascal-app/editor";
import type { FloorplanSceneDocument, SceneSaveState } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { ViewSwitch } from "./view-switch";

export type EditorHeaderProps = {
  onBack(): void;
  /** Builds the scene to submit, including edits autosave has not written yet. */
  currentDocument(): FloorplanSceneDocument;
  onSubmit?(document: FloorplanSceneDocument): Promise<unknown>;
  /** Pascal's own autosave status; the host's `saveState` decides failures and conflicts. */
  pascalStatus: SaveStatus;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

type SaveDisplay = "saving" | "saved" | "failed" | "conflict";

/** The host knows about failed and conflicting saves; Pascal knows about edits still waiting for autosave. */
export function saveDisplay(host: SceneSaveState, pascal: SaveStatus): SaveDisplay {
  if (host === "conflict" || host === "failed") return host;
  if (pascal === "error") return "failed";
  return host === "saving" || pascal === "pending" || pascal === "saving" ? "saving" : "saved";
}

const iconButton = "inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
const quietButton = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

function SaveStatusLabel({ pascalStatus }: { pascalStatus: SaveStatus }) {
  const { saveState, onRetrySave, onReload } = usePrismFloorplan();
  const display = saveDisplay(saveState, pascalStatus);
  if (display === "failed" || display === "conflict") {
    const [label, action] = display === "failed" ? ["Not saved · Retry", onRetrySave] : ["Changed elsewhere · Reload", onReload];
    return (
      <button type="button" onClick={action} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
        <TriangleAlert className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  const saving = display === "saving";
  const Icon = saving ? LoaderCircle : Check;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={saving ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
      {saving ? "Saving…" : "Saved"}
    </span>
  );
}

function HistoryButtons() {
  const canUndo = useSyncExternalStore(subscribeHistoryCommandState, () => getHistoryCommandState().canUndo, () => false);
  const canRedo = useSyncExternalStore(subscribeHistoryCommandState, () => getHistoryCommandState().canRedo, () => false);
  return (
    <>
      <button type="button" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => runUndo()} className={iconButton}>
        <Undo2 className="size-4" aria-hidden />
      </button>
      <button type="button" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => runRedo()} className={iconButton}>
        <Redo2 className="size-4" aria-hidden />
      </button>
    </>
  );
}

function SubmitButton({ currentDocument, onSubmit }: Pick<EditorHeaderProps, "currentDocument" | "onSubmit">) {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(currentDocument());
    } finally {
      setSubmitting(false);
    }
  }, [currentDocument, onSubmit]);
  return (
    <button
      type="button"
      onClick={() => void submit()}
      disabled={submitting}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      <Send className="size-4" aria-hidden />
      {submitting ? "Submitting…" : "Submit for review"}
    </button>
  );
}

/** PRISM's header in Pascal's navbar: the draft, its save state, history, views, and the review hand-off. */
export function EditorHeader({ onBack, currentDocument, onSubmit, pascalStatus, eventName, draftName, draftStatus }: EditorHeaderProps) {
  const { readOnly } = usePrismFloorplan();
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <button type="button" onClick={onBack} aria-label="Back to floor plans" title="Back to floor plans" className={iconButton}>
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{draftName ?? "Floor plan"}</p>
        <p className="truncate text-xs text-muted-foreground">{[eventName, draftStatus].filter(Boolean).join(" · ")}</p>
      </div>
      <span aria-disabled="true" title="Phases arrive with milestone 7" className={`${quietButton} ml-3`}>
        <Layers3 className="size-4" aria-hidden />
        Phases
      </span>
      <span className="flex-1" />
      {readOnly ? <span className="text-xs font-medium text-muted-foreground">View only</span> : <SaveStatusLabel pascalStatus={pascalStatus} />}
      {readOnly ? null : <HistoryButtons />}
      <ViewSwitch />
      <span aria-disabled="true" title="Client view arrives with milestone 5" className={quietButton}>
        <Eye className="size-4" aria-hidden />
        Preview as client
      </span>
      {onSubmit && !readOnly ? <SubmitButton currentDocument={currentDocument} onSubmit={onSubmit} /> : null}
    </div>
  );
}
