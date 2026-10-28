import { Minus, Plus, Maximize2, LocateFixed } from "lucide-react";
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
          type="button"
          title="Fit the plan to the screen"
          onClick={() => dispatch({ type: "FIT_TO_PLAN" })}
          className="ml-1 flex h-5 items-center gap-1 rounded px-1.5 hover:bg-neutral-100"
        >
          <Maximize2 size={11} aria-hidden="true" />
          Fit plan
        </button>
        <button
          type="button"
          title="Bring the selected objects into view"
          disabled={state.selectedIds.length === 0}
          onClick={() => dispatch({ type: "FOCUS_SELECTION" })}
          className="flex h-5 items-center gap-1 rounded px-1.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LocateFixed size={11} aria-hidden="true" />
          Find selected
        </button>
      </div>
    </div>
  );
}
