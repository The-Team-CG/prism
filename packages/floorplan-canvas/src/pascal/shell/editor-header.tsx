"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import { BookmarkPlus, Check, ChevronDown, ChevronLeft, Eye, LoaderCircle, Printer, Redo2, Send, TriangleAlert, Undo2 } from "lucide-react";
import { getHistoryCommandState, runRedo, runUndo, subscribeHistoryCommandState, type SaveStatus } from "@pascal-app/editor";
import type { FloorplanSceneDocument, SceneSaveState } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { Menu, menuItem } from "./menu";
import { ToolGroup } from "./tool-group";
import { ViewSwitch } from "./view-switch";
import { buildSeatingList, seatingListHtml } from "./seating-list";
import { planHtml, printHtml, pullSheetHtml } from "./print-documents";

export type EditorHeaderProps = {
  onBack(): void;
  /** Builds the scene to submit, including edits autosave has not written yet. */
  currentDocument(): FloorplanSceneDocument;
  onSubmit?(document: FloorplanSceneDocument): Promise<unknown>;
  /** Saves the scene as a venue template under the given name; the menu item is hidden when the host has no library. */
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

const iconButton =
  "inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent aria-expanded:bg-muted aria-expanded:text-foreground";

function SaveStatusLabel({ pascalStatus }: { pascalStatus: SaveStatus }) {
  const { saveState, saveMessage, onRetrySave, onReload } = usePrismFloorplan();
  const display = saveDisplay(saveState, pascalStatus);
  if (display === "failed" || display === "conflict") {
    const [label, action] = display === "failed" ? ["Not saved · Retry", onRetrySave] : ["Changed elsewhere · Reload", onReload];
    return (
      <button type="button" onClick={action} title={saveMessage ?? undefined} className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-destructive hover:bg-destructive/10">
        <TriangleAlert className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  const saving = display === "saving";
  const Icon = saving ? LoaderCircle : Check;
  return (
    <span role="status" className="mr-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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

type TemplateSaver = { currentDocument(): FloorplanSceneDocument; onSaveTemplate(document: FloorplanSceneDocument, name: string): Promise<unknown> };

/** Names the venue and saves the scene as its template; the form stays open with the reason when the save is refused. */
function TemplateForm({ currentDocument, onSaveTemplate, onDone }: TemplateSaver & { onDone(): void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
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
      onDone();
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : "The venue template could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void save(event)} className="w-64 space-y-2 p-1.5">
      <label htmlFor="venue-template-name" className="block text-xs font-medium text-foreground">
        Save as venue template
      </label>
      <input
        id="venue-template-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Venue name"
        autoFocus
        className="h-8 w-full rounded-lg bg-muted px-2.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring/40"
      />
      {refusal ? (
        <p role="alert" className="text-xs text-destructive">
          {refusal}
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onDone} className="h-8 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

type PlanMenuProps = { eventName?: string; draftName?: string; draftStatus?: string; onBack(): void; saver: TemplateSaver | null };

function PlanName({ eventName, draftName, draftStatus }: Pick<PlanMenuProps, "eventName" | "draftName" | "draftStatus">) {
  return (
    <>
      {eventName ? <span className="truncate text-muted-foreground">{eventName}</span> : null}
      {eventName ? <span className="text-muted-foreground/60">/</span> : null}
      <span className="truncate font-semibold text-foreground">{draftName ?? "Floor plan"}</span>
      {draftStatus ? <span className="shrink-0 text-muted-foreground">· {draftStatus}</span> : null}
    </>
  );
}

/** The plan's name in the middle of the bar, as Figma names its file; its menu saves the plan as a venue template and goes back. */
function PlanMenu({ onBack, saver, ...name }: PlanMenuProps) {
  const [naming, setNaming] = useState(false);
  return (
    <Menu
      align="center"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setNaming(false);
            toggle();
          }}
          className="inline-flex h-8 max-w-[28rem] items-center gap-1.5 rounded-lg px-2.5 text-[13px] hover:bg-muted aria-expanded:bg-muted"
        >
          <PlanName {...name} />
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    >
      {(close) =>
        naming && saver ? (
          <TemplateForm {...saver} onDone={close} />
        ) : (
          <>
            {saver ? (
              <button type="button" role="menuitem" onClick={() => setNaming(true)} className={menuItem}>
                <BookmarkPlus className="size-4 text-muted-foreground" aria-hidden />
                Save as venue template…
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={onBack} className={menuItem}>
              <ChevronLeft className="size-4 text-muted-foreground" aria-hidden />
              Back to floor plans
            </button>
          </>
        )
      }
    </Menu>
  );
}

/**
 * Prints the plan as it is now: the floor plan drawing in colour, the same plan as line work for the setup crew, the pull
 * sheet suppliers pack from, and, where guests can be seated, who sits where. The seating list is never offered to a client.
 */
function PrintMenu({ currentDocument, title }: { currentDocument(): FloorplanSceneDocument; title: string }) {
  const { guests, seating } = usePrismFloorplan();
  const [refusal, setRefusal] = useState<string | null>(null);
  const documents = [
    { label: "Floor plan", html: () => planHtml(title, currentDocument()) },
    { label: "Setup drawing", html: () => planHtml(title, currentDocument(), "drafting") },
    { label: "Pull sheet", html: () => pullSheetHtml(title, currentDocument()) },
    ...(seating.allowed ? [{ label: "Seating list", html: () => seatingListHtml(title, buildSeatingList(currentDocument(), guests)) }] : []),
  ];
  return (
    <div className="relative">
      <Menu
        trigger={({ open, toggle }) => (
          <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Print" title="Print" onClick={toggle} className={iconButton}>
            <Printer className="size-4" aria-hidden />
          </button>
        )}
      >
        {(close) =>
          documents.map(({ label, html }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setRefusal(printHtml(html()) ? null : "Allow pop-ups for this site to print.");
              }}
              className={menuItem}
            >
              {label}
            </button>
          ))
        }
      </Menu>
      {refusal ? (
        <span role="alert" title={refusal} className="absolute right-0 top-full mt-1 max-w-56 truncate text-xs text-destructive">
          {refusal}
        </span>
      ) : null}
    </div>
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
      className="ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(190_24_93/0.35)] disabled:opacity-60"
    >
      <Send className="size-3.5" aria-hidden />
      {submitting ? "Submitting…" : label}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />;

/**
 * PRISM's top bar in Pascal's navbar, the editor's one toolbar: back, the tools and the view on the left; the plan's
 * name in the middle; its save state, history, printing, preview and the review hand-off on the right.
 */
export function EditorHeader({ onBack, currentDocument, onSubmit, onSaveTemplate, submitLabel, pascalStatus, eventName, draftName, draftStatus }: EditorHeaderProps) {
  const { readOnly } = usePrismFloorplan();
  const saver = onSaveTemplate && !readOnly ? { currentDocument, onSaveTemplate } : null;
  return (
    <div className="relative flex h-12 w-full min-w-0 shrink-0 items-center gap-0.5 border-b border-border bg-background px-2.5">
      <button type="button" onClick={onBack} aria-label="Back to floor plans" title="Back to floor plans" className={iconButton}>
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <Divider />
      {readOnly ? null : (
        <>
          <ToolGroup />
          <Divider />
        </>
      )}
      <ViewSwitch />
      <div className="absolute left-1/2 -translate-x-1/2">
        <PlanMenu eventName={eventName} draftName={draftName} draftStatus={draftStatus} onBack={onBack} saver={saver} />
      </div>
      <span className="flex-1" />
      {readOnly ? <span className="mr-1.5 text-xs font-medium text-muted-foreground">View only</span> : <SaveStatusLabel pascalStatus={pascalStatus} />}
      {readOnly ? null : <HistoryButtons />}
      <Divider />
      <PrintMenu currentDocument={currentDocument} title={draftName ?? "Floor plan"} />
      <button type="button" disabled aria-label="Preview as client" title="Preview as client arrives with milestone 5" className={iconButton}>
        <Eye className="size-4" aria-hidden />
      </button>
      {onSubmit && !readOnly ? <SubmitButton currentDocument={currentDocument} onSubmit={onSubmit} submitLabel={submitLabel} /> : null}
    </div>
  );
}
