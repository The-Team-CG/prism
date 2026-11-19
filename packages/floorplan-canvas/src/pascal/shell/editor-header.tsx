"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import { BookmarkPlus, Check, ChevronLeft, Eye, Layers3, LoaderCircle, Printer, Redo2, Send, TriangleAlert, Undo2 } from "lucide-react";
import { getHistoryCommandState, runRedo, runUndo, subscribeHistoryCommandState, type SaveStatus } from "@pascal-app/editor";
import type { FloorplanSceneDocument, SceneSaveState } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { ViewSwitch } from "./view-switch";
import { buildSeatingList, printSeatingList } from "./seating-list";

export type EditorHeaderProps = {
  onBack(): void;
  /** Builds the scene to submit, including edits autosave has not written yet. */
  currentDocument(): FloorplanSceneDocument;
  onSubmit?(document: FloorplanSceneDocument): Promise<unknown>;
  /** Saves the scene as a venue template under the given name; the header is hidden when the host has no library. */
  onSaveTemplate?(document: FloorplanSceneDocument, name: string): Promise<unknown>;
  /** The review hand-off's label; a client's revision returns to PMCM rather than going for review. */
  submitLabel?: string;
  /** Pascal's own autosave status; the host's `saveState` decides failures and conflicts. */
  pascalStatus: SaveStatus;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

type SaveDisplay = "saving" | "saved" | "failed" | "conflict";

/**
 * The host's saver decides failures and conflicts, so a successful Retry clears them even though Pascal's own status
 * stays at "error" until the next edit. Pascal knows about edits still waiting for autosave.
 */
export function saveDisplay(host: SceneSaveState, pascal: SaveStatus): SaveDisplay {
  if (host === "conflict" || host === "failed") return host;
  return host === "saving" || pascal === "pending" || pascal === "saving" ? "saving" : "saved";
}

const iconButton = "inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
const quietButton = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

function SaveStatusLabel({ pascalStatus }: { pascalStatus: SaveStatus }) {
  const { saveState, saveMessage, onRetrySave, onReload } = usePrismFloorplan();
  const display = saveDisplay(saveState, pascalStatus);
  if (display === "failed" || display === "conflict") {
    const [label, action] = display === "failed" ? ["Not saved · Retry", onRetrySave] : ["Changed elsewhere · Reload", onReload];
    return (
      <button type="button" onClick={action} title={saveMessage ?? undefined} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
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

/** Names the venue and saves the scene as its template; the form stays open with the reason when the save is refused. */
function SaveTemplateAction({ currentDocument, onSaveTemplate }: { currentDocument(): FloorplanSceneDocument; onSaveTemplate(document: FloorplanSceneDocument, name: string): Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setRefusal(null);
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const venue = name.trim();
    if (!venue) {
      setRefusal("Name the venue before saving it.");
      return;
    }
    setBusy(true);
    setRefusal(null);
    try {
      await onSaveTemplate(currentDocument(), venue);
      setName("");
      close();
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : "The venue template could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={quietButton}>
        <BookmarkPlus className="size-4" aria-hidden />
        Save as venue template
      </button>
    );
  }
  return (
    <form onSubmit={(event) => void save(event)} className="flex items-center gap-1.5">
      <label htmlFor="venue-template-name" className="sr-only">Venue name</label>
      <input
        id="venue-template-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Venue name"
        autoFocus
        className="w-44 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
      />
      <button type="submit" disabled={busy} className="rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={close} className={quietButton}>Cancel</button>
      {refusal ? <span role="alert" title={refusal} className="max-w-56 truncate text-xs text-destructive">{refusal}</span> : null}
    </form>
  );
}

/** Prints who sits where, from the scene as it is now. Offered only where guests can be seated, so a client never sees it. */
function SeatingListAction({ currentDocument, title }: { currentDocument(): FloorplanSceneDocument; title: string }) {
  const { guests, seating } = usePrismFloorplan();
  const [refusal, setRefusal] = useState<string | null>(null);
  if (!seating.allowed) return null;
  function print() {
    setRefusal(printSeatingList(title, buildSeatingList(currentDocument(), guests)) ? null : "Allow pop-ups for this site to print the seating list.");
  }
  return (
    <>
      <button type="button" onClick={print} className={quietButton}>
        <Printer className="size-4" aria-hidden />
        Seating list
      </button>
      {refusal ? <span role="alert" title={refusal} className="max-w-56 truncate text-xs text-destructive">{refusal}</span> : null}
    </>
  );
}

function SubmitButton({ currentDocument, onSubmit, submitLabel }: Pick<EditorHeaderProps, "currentDocument" | "onSubmit" | "submitLabel">) {
  const { saveState } = usePrismFloorplan();
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const submit = useCallback(async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    setRefusal(null);
    try {
      await onSubmit(currentDocument());
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : "The plan could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }, [currentDocument, onSubmit]);
  return (
    <>
      {refusal ? (
        <span role="alert" title={refusal} className="max-w-56 truncate text-xs text-destructive">
          {refusal}
        </span>
      ) : null}
      <SubmitAction submitting={submitting} blocked={saveState === "conflict"} label={submitLabel ?? "Submit for review"} onClick={() => void submit()} />
    </>
  );
}

/** Submitting is blocked while the plan is in conflict: its latest edits were never saved. */
function SubmitAction({ submitting, blocked, label, onClick }: { submitting: boolean; blocked: boolean; label: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting || blocked}
      title={blocked ? "Reload the plan before submitting it" : undefined}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      <Send className="size-4" aria-hidden />
      {submitting ? "Submitting…" : label}
    </button>
  );
}

/** PRISM's header in Pascal's navbar: the draft, its save state, history, views, and the review hand-off. */
export function EditorHeader({ onBack, currentDocument, onSubmit, onSaveTemplate, submitLabel, pascalStatus, eventName, draftName, draftStatus }: EditorHeaderProps) {
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
      {readOnly ? null : <SeatingListAction currentDocument={currentDocument} title={draftName ?? "Seating list"} />}
      <ViewSwitch />
      <span aria-disabled="true" title="Client view arrives with milestone 5" className={quietButton}>
        <Eye className="size-4" aria-hidden />
        Preview as client
      </span>
      {onSaveTemplate && !readOnly ? <SaveTemplateAction currentDocument={currentDocument} onSaveTemplate={onSaveTemplate} /> : null}
      {onSubmit && !readOnly ? <SubmitButton currentDocument={currentDocument} onSubmit={onSubmit} submitLabel={submitLabel} /> : null}
    </div>
  );
}
