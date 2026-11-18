"use client";

import { useEffect, useMemo } from "react";
import { emitter, snapPointToGrid, useScene, type AnyNode, type GridEvent } from "@pascal-app/core";
import { isGridSnapActive, useEditor, usePlacementPreview } from "@pascal-app/editor";
import { useViewer } from "@pascal-app/viewer";
import { isPrismEventPieceType, type PrismEventPieceType } from "@prism/types";
import { eventPieceDefaults } from "../event-layout-plugin";
import { placeNode } from "./place-node";

export type Position = [number, number, number];

/** The cursor on the level, snapped to Pascal's grid unless snapping is off. */
export function snappedPosition(event: GridEvent): Position {
  const [x, , z] = event.localPosition;
  if (!isGridSnapActive()) return [x, 0, z];
  const [sx, sz] = snapPointToGrid([x, z], useEditor.getState().gridSnapStep);
  return [sx, 0, sz];
}

/** The armed Library piece's values: the kind's defaults, then the tile's. */
export function useArmedPieceValues(kind: PrismEventPieceType) {
  const tileValues = useEditor((state) => state.toolDefaults[kind]);
  return useMemo(() => ({ ...eventPieceDefaults(kind), ...tileValues }), [kind, tileValues]);
}

function Placement({ kind, levelId }: { kind: PrismEventPieceType; levelId: string }) {
  const defaults = useArmedPieceValues(kind);

  useEffect(() => {
    const preview = placeNode(kind, defaults, [0, 0, 0], {}, levelId);
    let last: Position | null = null;
    const onMove = (event: GridEvent) => {
      last = snappedPosition(event);
      usePlacementPreview.getState().set({ ...preview, position: last } as unknown as AnyNode);
    };
    const onClick = (event: GridEvent) => {
      if (useScene.getState().readOnly) return;
      const piece = placeNode(kind, defaults, last ?? snappedPosition(event), useScene.getState().nodes, levelId);
      useScene.getState().createNode(piece as unknown as AnyNode, levelId as AnyNode["id"]);
      (event as { nativeEvent?: { stopPropagation?: () => void } }).nativeEvent?.stopPropagation?.();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") useEditor.getState().setTool(null);
    };
    emitter.on("grid:move", onMove);
    emitter.on("grid:click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      emitter.off("grid:move", onMove);
      emitter.off("grid:click", onClick);
      window.removeEventListener("keydown", onKey);
      usePlacementPreview.getState().clear();
    };
  }, [kind, defaults, levelId]);

  return null;
}

/**
 * Places the armed Library piece: each click on the plan or in 3D places one, and a ghost follows the snapped cursor
 * on the plan. It lives in the host, not Pascal's 3D tool slot, because Pascal mounts tools inside the 3D canvas,
 * which a plan opened in 2D never mounts. The tool stays armed for the next piece; Esc or Select ends it.
 */
export function PiecePlacement() {
  const armed = useEditor((state) => (state.mode === "build" ? state.tool : null));
  const levelId = useViewer((state) => state.selection.levelId);
  if (!armed || !isPrismEventPieceType(armed) || !levelId) return null;
  return <Placement kind={armed} levelId={levelId} />;
}
