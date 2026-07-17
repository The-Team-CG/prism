import { MousePointer2, Hand, Square, Circle, Minus, Type } from "lucide-react";
import { useEditor } from "./store";
import type { Tool } from "./types";

const GROUP_A: { id: Tool; icon: React.ComponentType<{ size?: number | string }>; label: string; shortcut: string }[] = [
  { id: "select", icon: MousePointer2, label: "Move", shortcut: "V" },
  { id: "hand", icon: Hand, label: "Hand", shortcut: "H" },
];
const GROUP_B: typeof GROUP_A = [
  { id: "rect", icon: Square, label: "Rectangle", shortcut: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", shortcut: "O" },
  { id: "line", icon: Minus, label: "Line / Wall", shortcut: "L" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
];

function ToolButton({ t }: { t: (typeof GROUP_A)[number] }) {
  const { state, dispatch } = useEditor();
  const active = state.tool === t.id;
  const Icon = t.icon;
  return (
    <button
      onClick={() => dispatch({ type: "SET_TOOL", tool: t.id })}
      title={`${t.label} (${t.shortcut})`}
      className={[
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active ? "bg-[var(--prism-ink)] text-white shadow-sm" : "text-neutral-700 hover:bg-neutral-100",
      ].join(" ")}
    >
      <Icon size={15} />
    </button>
  );
}

export function Toolbar() {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1 rounded-lg bg-white/95 px-1.5 py-1 shadow-[0_8px_24px_rgba(192,24,103,0.12)] ring-1 ring-black/5 backdrop-blur">
      {GROUP_A.map((t) => <ToolButton key={t.id} t={t} />)}
      <div className="mx-0.5 h-5 w-px bg-neutral-200" />
      {GROUP_B.map((t) => <ToolButton key={t.id} t={t} />)}
    </div>
  );
}
