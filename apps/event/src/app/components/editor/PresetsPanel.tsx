import { useEditor } from "./store";
import { PRESETS } from "./presets";
import { Sparkles } from "lucide-react";

export function PresetsPanel() {
  const { state, dispatch } = useEditor();
  const p = state.project;
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-1.5 px-1 text-xs text-neutral-500">
        <Sparkles size={12} /> Quick Setup Presets
      </div>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => {
            const objs = preset.build(p.widthM, p.heightM, p.pax);
            if (!confirm(`Apply "${preset.name}"? This replaces current objects.`)) return;
            dispatch({ type: "ADD_OBJECTS", objs, replace: true });
          }}
          className="group rounded-md border border-neutral-200 bg-white p-2.5 text-left hover:border-primary hover:bg-[var(--prism-ink)]/5"
        >
          <div className="text-xs text-neutral-900 group-hover:text-foreground">
            {preset.name}
          </div>
          <div className="mt-0.5 text-[11px] leading-tight text-neutral-500">
            {preset.description}
          </div>
        </button>
      ))}
    </div>
  );
}
