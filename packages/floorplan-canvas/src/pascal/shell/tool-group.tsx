"use client";

import { Eraser, MousePointer2, Ruler, type LucideIcon } from "lucide-react";
import { useEditor } from "@pascal-app/editor";

type EditorState = ReturnType<typeof useEditor.getState>;

type Tool = { id: string; label: string; shortcut: string; icon: LucideIcon; isActive(state: EditorState): boolean; arm(): void };

/** The tools a planner works the plan with; Pascal's own keys (V, M, X) arm the same tools. */
const TOOLS: ReadonlyArray<Tool> = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: MousePointer2,
    isActive: (state) => state.mode === "select",
    arm: () => {
      useEditor.getState().armToolMode({ mode: "select" });
      useEditor.getState().setFloorplanSelectionTool("click");
    },
  },
  {
    id: "measure",
    label: "Measure",
    shortcut: "M",
    icon: Ruler,
    isActive: (state) => state.mode === "build" && state.tool === "measurement",
    arm: () => {
      const editor = useEditor.getState();
      editor.setToolDefaults("measurement", { kind: "smart" });
      editor.setMode("build");
      editor.setTool("measurement");
    },
  },
  {
    id: "delete",
    label: "Delete",
    shortcut: "X",
    icon: Eraser,
    isActive: (state) => state.mode === "delete",
    arm: () => useEditor.getState().armToolMode({ mode: "delete" }),
  },
];

/** Select, measure and delete, in the top bar where Pascal's floating tool dock used to be. The armed tool is in ink. */
export function ToolGroup() {
  const active = useEditor((state) => TOOLS.find((tool) => tool.isActive(state))?.id ?? null);
  return (
    <div role="group" aria-label="Tools" className="flex items-center gap-0.5">
      {TOOLS.map(({ id, label, shortcut, icon: Icon, arm }) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          aria-label={label}
          title={`${label} (${shortcut})`}
          onClick={arm}
          className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background"
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
