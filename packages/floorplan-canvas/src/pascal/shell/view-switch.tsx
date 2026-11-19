"use client";

import { sceneLayout, useEditor, visibleScene, type VisibleScene } from "@pascal-app/editor";

const VIEWS: ReadonlyArray<{ scene: VisibleScene; label: string }> = [
  { scene: "2d", label: "2D" },
  { scene: "3d", label: "3D" },
  { scene: "split", label: "Split" },
];

/** 2D, 3D or the plan beside 3D, replacing Pascal's view bar. */
export function ViewSwitch() {
  const current = useEditor(visibleScene);
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-md bg-muted p-0.5">
      {VIEWS.map(({ scene, label }) => (
        <button
          key={scene}
          type="button"
          aria-pressed={current === scene}
          onClick={() => useEditor.getState().setViewLayout(sceneLayout(scene))}
          className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
