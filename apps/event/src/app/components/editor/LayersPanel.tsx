import { Eye, EyeOff, Lock, Unlock, Circle, Square as SquareIcon, Minus } from "lucide-react";
import { useEditor } from "./store";

export function LayersPanel() {
  const { state, dispatch } = useEditor();
  const objs = [...state.project.objects].reverse();

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {objs.length === 0 && (
        <div className="px-2 py-6 text-center text-xs text-neutral-400">
          Drag assets onto the canvas to start
        </div>
      )}
      {objs.map((o) => {
        const selected = state.selectedIds.includes(o.id);
        const Icon = o.kind === "ellipse" ? Circle : o.kind === "line" ? Minus : SquareIcon;
        return (
          <div
            key={o.id}
            onClick={(e) => {
              if (e.shiftKey) dispatch({ type: "ADD_SELECTION", id: o.id });
              else dispatch({ type: "SET_SELECTION", ids: [o.id] });
            }}
            className={[
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs cursor-default",
              selected ? "bg-[var(--prism-ink)]/10 text-foreground" : "hover:bg-neutral-100 text-neutral-700",
            ].join(" ")}
          >
            <Icon size={12} className="text-neutral-500" />
            <input
              value={o.label || o.name}
              onChange={(e) => dispatch({ type: "UPDATE_OBJECT", id: o.id, patch: { label: e.target.value } })}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 truncate bg-transparent text-xs outline-none focus:bg-white rounded px-1"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "UPDATE_OBJECT", id: o.id, patch: { hidden: !o.hidden } });
              }}
              className="opacity-60 hover:opacity-100"
            >
              {o.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "UPDATE_OBJECT", id: o.id, patch: { locked: !o.locked } });
              }}
              className="opacity-60 hover:opacity-100"
            >
              {o.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
