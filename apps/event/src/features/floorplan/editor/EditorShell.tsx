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

function ShellUIProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const narrow = w < 900;
      const tight = w < 1200;
      setIsNarrow(narrow);
      if (narrow) {
        setLeftOpen(false);
        setRightOpen(false);
      } else if (tight) {
        setRightOpen(false);
      }
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
        {!readOnly && leftOpen && (
          <div className={[isNarrow ? "absolute inset-y-0 left-0 z-20 shadow-xl" : "relative", "flex"].join(" ")}>
            <LeftPanel />
          </div>
        )}
        {!readOnly && isNarrow && leftOpen && (
          <button
            aria-label="Close panel"
            onClick={() => (document.activeElement as HTMLElement)?.blur()}
            className="absolute inset-0 z-10 bg-black/20"
            style={{ pointerEvents: "none" }}
          />
        )}

        <div className="relative min-w-0 flex-1">
          <div className={readOnly ? "pointer-events-none size-full" : "size-full"}>
            <Canvas />
          </div>
          {!readOnly && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <Toolbar />
            </div>
          )}
        </div>

        {!readOnly && rightOpen && (
          <div className={[isNarrow ? "absolute inset-y-0 right-0 z-20 shadow-xl" : "relative", "flex"].join(" ")}>
            <RightPanel />
          </div>
        )}
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
