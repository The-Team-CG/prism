import { useMemo } from "react";
import type { AnyNode } from "@pascal-app/core";
import { useViewer } from "@pascal-app/viewer";
import { layoutChecks } from "@prism/floorplan-scene";
import type { PrismLayoutIssue } from "@prism/types";
import { useLiveScene } from "./use-live-scene";

/** The plan's layout checks as it stands now; they rerun on every edit. */
export function useLayoutChecks(): PrismLayoutIssue[] {
  const scene = useLiveScene();
  return useMemo(() => layoutChecks(scene), [scene]);
}

/** Selects the pieces a check is about, so the planner sees them on the plan and in the inspector. */
export function selectIssue(issue: PrismLayoutIssue) {
  useViewer.getState().setSelection({ selectedIds: issue.pieceIds as AnyNode["id"][] });
}
