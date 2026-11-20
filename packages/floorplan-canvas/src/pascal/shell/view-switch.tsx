"use client";

import { sceneLayout, useEditor, visibleScene, type VisibleScene } from "@pascal-app/editor";
import { Segmented } from "./segmented";

const VIEWS: ReadonlyArray<{ value: VisibleScene; label: string }> = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
  { value: "split", label: "Split" },
];

/** 2D, 3D or the plan beside 3D, replacing Pascal's view bar. */
export function ViewSwitch() {
  const current = useEditor(visibleScene);
  return <Segmented label="View" options={VIEWS} value={current} onChange={(scene) => useEditor.getState().setViewLayout(sceneLayout(scene))} />;
}
