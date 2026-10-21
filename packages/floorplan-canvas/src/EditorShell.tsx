import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EditorProvider, useEditor, useKeyboard } from "./store";
import { TopBar } from "./TopBar";
import { Toolbar } from "./Toolbar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Canvas } from "./Canvas";
import { StatusBar } from "./StatusBar";
import type { Project, TableAssignmentIneligibleReason } from "./types";
import type { TemplateStore } from "./template-store";

/** Role-supplied copy for each refused table assignment code. */
export type AssignmentRejectionMessages = Record<TableAssignmentIneligibleReason, string>;

const DEFAULT_ASSIGNMENT_REJECTION_MESSAGE = "This guest cannot be seated at that table.";

interface ShellUI {
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (b: boolean) => void;
  setRightOpen: (b: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  isNarrow: boolean;
}

export interface EditorShellProps {
  project: Project;
  onBack: () => void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
  submitLabel?: string;
  readOnly?: boolean;
  readOnlyLabel: string;
  templateStore: TemplateStore;
  onSave?: (project: Project) => Promise<unknown>;
  onSubmit?: (project: Project) => Promise<unknown>;
  /** Copy for refused table assignments; read-only shells never trigger them and may omit it. */
  assignmentRejectionMessages?: AssignmentRejectionMessages;
}

function AssignmentRejectionNotice({ messages }: { messages?: AssignmentRejectionMessages }) {
  const { state, dispatch } = useEditor();
  const rejection = state.assignmentRejection;
  if (!rejection) return null;
  return (
    <div
      role="alert"
      className="pointer-events-auto absolute bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 shadow"
    >
      <span>{messages?.[rejection.reason] ?? DEFAULT_ASSIGNMENT_REJECTION_MESSAGE}</span>
      <button
        type="button"
        onClick={() => dispatch({ type: "DISMISS_ASSIGNMENT_REJECTION" })}
        className="text-neutral-500 underline-offset-2 hover:text-neutral-900"
      >
        Dismiss
      </button>
    </div>
  );
}

const ShellCtx = createContext<ShellUI | null>(null);

export function useShellUI() {
  const c = useContext(ShellCtx);
  if (!c) throw new Error("useShellUI outside provider");
  return c;
}

function applyViewportBreakpoints(
  width: number,
  setIsNarrow: (value: boolean) => void,
  setLeftOpen: (value: boolean) => void,
  setRightOpen: (value: boolean) => void,
) {
  const narrow = width < 900;
  const tight = width < 1200;
  setIsNarrow(narrow);
  if (narrow) {
    setLeftOpen(false);
    setRightOpen(false);
    return;
  }
  if (tight) setRightOpen(false);
}

function ShellUIProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    function update() {
      applyViewportBreakpoints(window.innerWidth, setIsNarrow, setLeftOpen, setRightOpen);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const value: ShellUI = {
    leftOpen,
    rightOpen,
    setLeftOpen,
    setRightOpen,
    toggleLeft: () => setLeftOpen((v) => !v),
    toggleRight: () => setRightOpen((v) => !v),
    isNarrow,
  };

  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}

function dockClass(isNarrow: boolean, edge: "left" | "right"): string {
  if (!isNarrow) return ["relative", "flex"].join(" ");
  if (edge === "left") return ["absolute inset-y-0 left-0 z-20 shadow-xl", "flex"].join(" ");
  return ["absolute inset-y-0 right-0 z-20 shadow-xl", "flex"].join(" ");
}

function LeftChrome({
  readOnly,
  leftOpen,
  isNarrow,
  templateStore,
}: {
  readOnly: boolean;
  leftOpen: boolean;
  isNarrow: boolean;
  templateStore: TemplateStore;
}) {
  if (readOnly) return null;
  if (!leftOpen) return null;
  return (
    <>
      <div className={dockClass(isNarrow, "left")}>
        <LeftPanel templateStore={templateStore} />
      </div>
      <NarrowLeftScrim isNarrow={isNarrow} />
    </>
  );
}

function NarrowLeftScrim({ isNarrow }: { isNarrow: boolean }) {
  if (!isNarrow) return null;
  return (
    <button
      aria-label="Close panel"
      onClick={() => (document.activeElement as HTMLElement)?.blur()}
      className="absolute inset-0 z-10 bg-black/20"
      style={{ pointerEvents: "none" }}
    />
  );
}

function FloatingToolbar({ readOnly }: { readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
      <Toolbar />
    </div>
  );
}

function CanvasColumn({ readOnly }: { readOnly: boolean }) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className="size-full">
        <Canvas readOnly={readOnly} />
      </div>
      <FloatingToolbar readOnly={readOnly} />
    </div>
  );
}

function RightChrome({
  readOnly,
  rightOpen,
  isNarrow,
}: {
  readOnly: boolean;
  rightOpen: boolean;
  isNarrow: boolean;
}) {
  if (readOnly) return null;
  if (!rightOpen) return null;
  return (
    <div className={dockClass(isNarrow, "right")}>
      <RightPanel />
    </div>
  );
}

function Inner({
  onBack,
  templateStore,
  readOnlyLabel,
  eventName,
  draftName,
  draftStatus,
  submitLabel,
  readOnly = false,
  onSave,
  onSubmit,
  assignmentRejectionMessages,
}: Omit<EditorShellProps, "project">) {
  useKeyboard(readOnly);
  const { leftOpen, rightOpen, isNarrow } = useShellUI();

  return (
    <div className="flex size-full min-w-0 flex-col overflow-hidden bg-neutral-50">
      <div className="relative">
        <TopBar
          onBack={onBack}
          eventName={eventName}
          draftName={draftName}
          draftStatus={draftStatus}
          submitLabel={submitLabel}
          readOnly={readOnly}
          readOnlyLabel={readOnlyLabel}
          onSave={onSave}
          onSubmit={onSubmit}
        />
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <LeftChrome readOnly={readOnly} leftOpen={leftOpen} isNarrow={isNarrow} templateStore={templateStore} />
        <CanvasColumn readOnly={readOnly} />
        <RightChrome readOnly={readOnly} rightOpen={rightOpen} isNarrow={isNarrow} />
        <AssignmentRejectionNotice messages={assignmentRejectionMessages} />
      </div>
      <StatusBar />
    </div>
  );
}

export function EditorShell({ project, onBack, ...props }: EditorShellProps) {
  return (
    <EditorProvider project={project}>
      <ShellUIProvider>
        <Inner onBack={onBack} {...props} />
      </ShellUIProvider>
    </EditorProvider>
  );
}
