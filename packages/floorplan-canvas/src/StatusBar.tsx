import { Minus, Plus, Maximize2 } from "lucide-react";
import { useEditor } from "./store";

export function StatusBar() {
  const { state, dispatch } = useEditor();
  const z = Math.round(state.viewport.zoom * 3.3); // approx %
  return (
    <div className="flex h-7 items-center justify-between border-t border-neutral-200 bg-white px-3 text-[11px] text-neutral-500">
      <div className="flex items-center gap-3">
        <span>{state.project.objects.length} objects</span>
        <span>·</span>
        <span>{state.selectedIds.length} selected</span>
        <span>·</span>
        <span>Grid {state.gridSize}m</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            dispatch({
              type: "SET_VIEWPORT",
              viewport: { zoom: Math.max(5, state.viewport.zoom * 0.9) },
            })
          }
          className="flex size-5 items-center justify-center rounded hover:bg-neutral-100"
        >
          <Minus size={11} />
        </button>
        <span className="w-10 text-center tabular-nums">{z}%</span>
        <button
          onClick={() =>
            dispatch({
              type: "SET_VIEWPORT",
              viewport: { zoom: Math.min(400, state.viewport.zoom * 1.1) },
            })
          }
          className="flex size-5 items-center justify-center rounded hover:bg-neutral-100"
        >
          <Plus size={11} />
        </button>
        <button
          title="Fit"
          onClick={() => {
            const p = state.project;
            const pad = 80;
            // Rough fit — Canvas fit effect handles initial; this is a nudge.
            dispatch({
              type: "SET_VIEWPORT",
              viewport: { zoom: Math.min(30, 600 / p.widthM), tx: pad, ty: pad },
            });
          }}
          className="ml-1 flex size-5 items-center justify-center rounded hover:bg-neutral-100"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    </div>
  );
}
