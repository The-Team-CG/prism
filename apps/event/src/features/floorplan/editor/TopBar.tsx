import { useState } from "react";
import {
  ChevronLeft,
  Cloud,
  Eye,
  PanelLeft,
  PanelRight,
  Redo2,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import { useEditor } from "./store";
import { useShellUI } from "./EditorShell";
import type { Project } from "./types";

interface TopBarProps {
  onBack: () => void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
  readOnly?: boolean;
  onSave?: (project: Project) => Promise<unknown>;
  onSubmit?: (project: Project) => Promise<unknown>;
}

function statusLabel(value?: string) {
  return (value ?? "draft").replaceAll("_", " ");
}

export function TopBar({
  onBack,
  eventName,
  draftName,
  draftStatus,
  readOnly = false,
  onSave,
  onSubmit,
}: TopBarProps) {
  const { state, dispatch } = useEditor();
  const { leftOpen, rightOpen, toggleLeft, toggleRight } = useShellUI();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const canUndo = !readOnly && state.history.past.length > 0;
  const canRedo = !readOnly && state.history.future.length > 0;
  const canSubmit = !readOnly && draftStatus !== "approved" && Boolean(onSubmit);

  async function save() {
    if (!onSave || readOnly) return;
    setSaveState("saving");
    try {
      await onSave(state.project);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function submit() {
    if (!onSubmit || readOnly) return;
    setSaveState("saving");
    try {
      await onSubmit(state.project);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="relative flex h-[56px] shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
          title="Back to event"
        >
          <ChevronLeft size={18} />
        </button>
        {!readOnly && (
          <button
            onClick={toggleLeft}
            title={leftOpen ? "Hide left panel" : "Show left panel"}
            className={[
              "flex size-8 items-center justify-center rounded-md hover:bg-neutral-100",
              leftOpen ? "text-foreground" : "text-neutral-500",
            ].join(" ")}
          >
            <PanelLeft size={15} />
          </button>
        )}
        <div className="flex size-8 items-center justify-center rounded-md bg-[var(--prism-ink)] text-white" style={{ fontSize: 10, letterSpacing: "0.1em" }}>
          PR
        </div>
        <div className="mx-1 h-6 w-px bg-neutral-200" />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-neutral-500">
            <span>Events</span>
            <span>/</span>
            <span className="truncate">{eventName ?? state.project.venue}</span>
            <span>/</span>
            <span className="truncate capitalize">{statusLabel(draftStatus)}</span>
          </div>
          {readOnly ? (
            <div className="truncate text-sm font-medium text-neutral-900">
              {draftName ?? state.project.name}
            </div>
          ) : (
            <input
              value={state.project.name}
              onChange={(event) => dispatch({ type: "UPDATE_PROJECT", patch: { name: event.target.value } })}
              className="w-full max-w-md rounded bg-transparent px-1 text-sm font-medium text-neutral-900 outline-none focus:bg-neutral-100"
            />
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-0.5 py-0.5 md:flex">
          <button
            disabled={!canUndo}
            onClick={() => dispatch({ type: "UNDO" })}
            className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            disabled={!canRedo}
            onClick={() => dispatch({ type: "REDO" })}
            className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className={[
          "hidden items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium md:inline-flex",
          saveState === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
        ].join(" ")}>
          <Cloud size={12} />
          {saveState === "saving" ? "Saving" : saveState === "error" ? "Save failed" : "Saved"}
        </span>
        {readOnly ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-xs font-medium text-neutral-700">
            <Eye size={13} /> Read-only
          </span>
        ) : (
          <>
            <button
              onClick={toggleRight}
              title={rightOpen ? "Hide properties" : "Show properties"}
              className={[
                "flex h-8 items-center justify-center rounded-md border border-neutral-200 px-2 hover:bg-neutral-100",
                rightOpen ? "text-foreground" : "text-neutral-500",
              ].join(" ")}
            >
              <PanelRight size={13} />
            </button>
            <button
              onClick={save}
              disabled={!onSave || saveState === "saving"}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              <Save size={13} /> Save
            </button>
            {canSubmit && (
              <button
                onClick={submit}
                disabled={saveState === "saving"}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--prism-ink)] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#C01867] disabled:opacity-50"
              >
                <Send size={13} /> Submit review
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
