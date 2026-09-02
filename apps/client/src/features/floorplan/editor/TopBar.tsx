import { useState, type ReactNode } from "react";
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
import {
  canRedoHistory,
  canSubmitReview,
  canUndoHistory,
  panelOpenClass,
  panelToggleTitle,
  saveActionDisabled,
  saveStatusText,
  saveStatusToneClass,
  statusLabel,
  type SaveState,
} from "./top-bar-helpers";

interface TopBarProps {
  onBack: () => void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
  readOnly?: boolean;
  onSave?: (project: Project) => Promise<unknown>;
  onSubmit?: (project: Project) => Promise<unknown>;
}

function IconToggle({
  open,
  hideTitle,
  showTitle,
  onClick,
  className,
  children,
}: {
  open: boolean;
  hideTitle: string;
  showTitle: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={panelToggleTitle(open, hideTitle, showTitle)}
      className={[className, panelOpenClass(open)].join(" ")}
    >
      {children}
    </button>
  );
}

function ProjectNameField({
  readOnly,
  draftName,
  name,
  onChange,
}: {
  readOnly: boolean;
  draftName?: string;
  name: string;
  onChange: (value: string) => void;
}) {
  if (readOnly) {
    return (
      <div className="truncate text-sm font-medium text-neutral-900">{draftName ?? name}</div>
    );
  }
  return (
    <input
      value={name}
      onChange={(event) => onChange(event.target.value)}
      className="w-full max-w-md rounded bg-transparent px-1 text-sm font-medium text-neutral-900 outline-none focus:bg-neutral-100"
    />
  );
}

function LeftPanelToggle({
  readOnly,
  leftOpen,
  toggleLeft,
}: {
  readOnly: boolean;
  leftOpen: boolean;
  toggleLeft: () => void;
}) {
  if (readOnly) return null;
  return (
    <IconToggle
      open={leftOpen}
      hideTitle="Hide left panel"
      showTitle="Show left panel"
      onClick={toggleLeft}
      className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
    >
      <PanelLeft size={15} />
    </IconToggle>
  );
}

function HistoryButtons({
  readOnly,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  if (readOnly) return null;
  return (
    <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-0.5 py-0.5 md:flex">
      <button
        disabled={!canUndo}
        onClick={onUndo}
        className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
        title="Undo"
      >
        <Undo2 size={14} />
      </button>
      <button
        disabled={!canRedo}
        onClick={onRedo}
        className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
        title="Redo"
      >
        <Redo2 size={14} />
      </button>
    </div>
  );
}

function SaveStatusChip({ saveState }: { saveState: SaveState }) {
  return (
    <span
      className={[
        "hidden items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium md:inline-flex",
        saveStatusToneClass(saveState),
      ].join(" ")}
    >
      <Cloud size={12} />
      {saveStatusText(saveState)}
    </span>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-xs font-medium text-neutral-700">
      <Eye size={13} /> Floor plan view
    </span>
  );
}

function EditActions({
  rightOpen,
  toggleRight,
  onSave,
  onSubmit,
  saveDisabled,
  saving,
  canSubmit,
}: {
  rightOpen: boolean;
  toggleRight: () => void;
  onSave: () => void;
  onSubmit: () => void;
  saveDisabled: boolean;
  saving: boolean;
  canSubmit: boolean;
}) {
  return (
    <>
      <IconToggle
        open={rightOpen}
        hideTitle="Hide properties"
        showTitle="Show properties"
        onClick={toggleRight}
        className="flex h-8 items-center justify-center rounded-md border border-neutral-200 px-2 hover:bg-neutral-100"
      >
        <PanelRight size={13} />
      </IconToggle>
      <button
        onClick={onSave}
        disabled={saveDisabled}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
      >
        <Save size={13} /> Save
      </button>
      <SubmitReviewButton canSubmit={canSubmit} saving={saving} onSubmit={onSubmit} />
    </>
  );
}

function SubmitReviewButton({
  canSubmit,
  saving,
  onSubmit,
}: {
  canSubmit: boolean;
  saving: boolean;
  onSubmit: () => void;
}) {
  if (!canSubmit) return null;
  return (
    <button
      onClick={onSubmit}
      disabled={saving}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--prism-ink)] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#C01867] disabled:opacity-50"
    >
      <Send size={13} /> Submit review
    </button>
  );
}

function TrailingActions({
  readOnly,
  rightOpen,
  toggleRight,
  onSave,
  onSubmit,
  saveDisabled,
  saving,
  canSubmit,
}: {
  readOnly: boolean;
  rightOpen: boolean;
  toggleRight: () => void;
  onSave: () => void;
  onSubmit: () => void;
  saveDisabled: boolean;
  saving: boolean;
  canSubmit: boolean;
}) {
  if (readOnly) return <ReadOnlyBadge />;
  return (
    <EditActions
      rightOpen={rightOpen}
      toggleRight={toggleRight}
      onSave={onSave}
      onSubmit={onSubmit}
      saveDisabled={saveDisabled}
      saving={saving}
      canSubmit={canSubmit}
    />
  );
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const canUndo = canUndoHistory(readOnly, state.history.past.length);
  const canRedo = canRedoHistory(readOnly, state.history.future.length);
  const canSubmit = canSubmitReview(readOnly, draftStatus, Boolean(onSubmit));

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
        <LeftPanelToggle readOnly={readOnly} leftOpen={leftOpen} toggleLeft={toggleLeft} />
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
          <ProjectNameField
            readOnly={readOnly}
            draftName={draftName}
            name={state.project.name}
            onChange={(name) => dispatch({ type: "UPDATE_PROJECT", patch: { name } })}
          />
        </div>
      </div>

      <HistoryButtons
        readOnly={readOnly}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
      />

      <div className="flex items-center gap-1.5">
        <SaveStatusChip saveState={saveState} />
        <TrailingActions
          readOnly={readOnly}
          rightOpen={rightOpen}
          toggleRight={toggleRight}
          onSave={save}
          onSubmit={submit}
          saveDisabled={saveActionDisabled(Boolean(onSave), saveState)}
          saving={saveState === "saving"}
          canSubmit={canSubmit}
        />
      </div>
    </div>
  );
}
