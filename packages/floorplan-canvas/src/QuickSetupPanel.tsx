import { useState } from "react";
import { useEditor } from "./store";
import { isPermanentFeature } from "./templates";
import { arrangeQuickSetup, QUICK_SETUP_PRESETS, type QuickSetupPreset } from "./quick-setup";

/** FR-82: one-click starting layouts sized to the venue and guest count. Venue fixtures stay; everything else is replaced. */
export function QuickSetupPanel() {
  const { state, dispatch } = useEditor();
  const [notice, setNotice] = useState<string | null>(null);
  const groups = [...new Set(QUICK_SETUP_PRESETS.map((preset) => preset.group))];

  function apply(preset: QuickSetupPreset) {
    const movable = state.project.objects.filter((object) => !isPermanentFeature(object));
    if (movable.length > 0 && !confirm(`Use "${preset.name}"? This replaces the current layout; venue walls and fixtures stay.`)) return;
    const { objects, shortfall } = arrangeQuickSetup(preset, { widthM: state.project.widthM, heightM: state.project.heightM, pax: state.project.pax });
    dispatch({ type: "APPLY_TEMPLATE", patch: {}, objects: [...state.project.objects.filter(isPermanentFeature), ...objects] });
    setNotice(shortfall > 0 ? `${preset.name} placed, but the room seats ${shortfall} fewer than ${state.project.pax} guests. Adjust from here.` : `${preset.name} placed. Adjust from here.`);
  }

  return (
    <div className="px-3 pb-3 pt-3">
      <div className="text-xs font-medium text-neutral-500">Quick setup</div>
      <p className="mt-0.5 text-[10px] text-neutral-500">Arranged for {state.project.pax || 0} guests in {state.project.widthM} m × {state.project.heightM} m.</p>
      {notice ? <p role="status" className="mt-1.5 rounded-md bg-muted px-2 py-1 text-[10px] text-neutral-700">{notice}</p> : null}
      {groups.map((group) => (
        <details key={group} className="mt-1.5">
          <summary className="cursor-pointer text-[11px] font-medium text-neutral-800">{group}</summary>
          <div className="mt-1 flex flex-col gap-1">
            {QUICK_SETUP_PRESETS.filter((preset) => preset.group === group).map((preset) => (
              <button key={preset.id} type="button" onClick={() => apply(preset)} className="rounded-md bg-white px-2 py-1 text-left text-[11px] ring-1 ring-neutral-200 hover:ring-primary/40">{preset.name}</button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
