import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EditorProvider, useKeyboard } from "./store";
import { TopBar } from "./TopBar";
import { Toolbar } from "./Toolbar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Canvas } from "./Canvas";
import { StatusBar } from "./StatusBar";
import type { Project } from "./types";

interface ShellUI {
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (b: boolean) => void;
  setRightOpen: (b: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  isNarrow: boolean;
}

interface EditorShellProps {
  project: Project;
  onBack: () => void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
  readOnly?: boolean;
  onSave?: (project: Project) => Promise<unknown>;
  onSubmit?: (project: Project) => Promise<unknown>;
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
}: {
  readOnly: boolean;
  leftOpen: boolean;
  isNarrow: boolean;
}) {
  if (readOnly) return null;
  if (!leftOpen) return null;
  return (
    <>
      <div className={dockClass(isNarrow, "left")}>
        <LeftPanel />
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

function canvasFrameClass(readOnly: boolean): string {
  if (readOnly) return "pointer-events-none size-full";
  return "size-full";
}

function CanvasColumn({ readOnly }: { readOnly: boolean }) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className={canvasFrameClass(readOnly)}>
        <Canvas />
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
  eventName,
  draftName,
  draftStatus,
  readOnly = false,
  onSave,
  onSubmit,
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
          readOnly={readOnly}
          onSave={onSave}
          onSubmit={onSubmit}
        />
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <LeftChrome readOnly={readOnly} leftOpen={leftOpen} isNarrow={isNarrow} />
        <CanvasColumn readOnly={readOnly} />
        <RightChrome readOnly={readOnly} rightOpen={rightOpen} isNarrow={isNarrow} />
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
