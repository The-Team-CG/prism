"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {} from "@react-three/fiber";
import type { Group, Material, Mesh } from "three";
import { emitter, nodeRegistry, snapPointToGrid, useScene, type AnyNode, type GridEvent } from "@pascal-app/core";
import { isGridSnapActive, useEditor, usePlacementPreview } from "@pascal-app/editor";
import { useViewer } from "@pascal-app/viewer";
import { isPrismEventPieceType, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { eventPieceDefaults } from "../event-layout-plugin";
import { placeNode } from "./place-node";

type Position = [number, number, number];

function snapped(event: GridEvent): Position {
  const [x, , z] = event.localPosition;
  if (!isGridSnapActive()) return [x, 0, z];
  const [sx, sz] = snapPointToGrid([x, z], useEditor.getState().gridSnapStep);
  return [sx, 0, sz];
}

/** A see-through copy of the piece's 3D shape, built by its own definition. */
function ghostOf(piece: PrismEventPiece): Group | null {
  const built = nodeRegistry.get(piece.type)?.geometry?.(piece as never, {} as never) as Group | undefined;
  built?.traverse((child) => {
    const material = (child as Mesh).material as Material | undefined;
    if (material) Object.assign(material, { transparent: true, opacity: 0.45, depthWrite: false });
  });
  return built ?? null;
}

function stopClick(event: GridEvent) {
  const native = (event as { nativeEvent?: { stopPropagation?: () => void } }).nativeEvent;
  native?.stopPropagation?.();
}

/**
 * Places the armed Library piece: a ghost follows the snapped cursor in 3D and on the plan, and each click places
 * one piece. The tool stays armed for the next; Esc or Select ends it. A read-only scene places nothing.
 */
function PlacePieceTool({ kind, levelId }: { kind: PrismEventPieceType; levelId: string }) {
  const tileValues = useEditor((state) => state.toolDefaults[kind]);
  const defaults = useMemo(() => ({ ...eventPieceDefaults(kind), ...tileValues }), [kind, tileValues]);
  const preview = useMemo(() => placeNode(kind, defaults, [0, 0, 0], {}, levelId), [kind, defaults, levelId]);
  const ghost = useMemo(() => ghostOf(preview), [preview]);
  const cursor = useRef<Group>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let last: Position | null = null;
    const onMove = (event: GridEvent) => {
      last = snapped(event);
      setVisible(true);
      cursor.current?.position.set(...last);
      usePlacementPreview.getState().set({ ...preview, position: last } as unknown as AnyNode);
    };
    const onClick = (event: GridEvent) => {
      if (useScene.getState().readOnly) return;
      const piece = placeNode(kind, defaults, last ?? snapped(event), useScene.getState().nodes, levelId);
      useScene.getState().createNode(piece as unknown as AnyNode, levelId as AnyNode["id"]);
      stopClick(event);
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
  }, [kind, defaults, levelId, preview]);

  return (
    <group ref={cursor} visible={visible}>
      {ghost ? <primitive object={ghost} /> : null}
    </group>
  );
}

/** Pascal mounts one tool per armed kind; this one serves every PRISM event piece. */
export default function PlacePieceToolHost() {
  const tool = useEditor((state) => state.tool);
  const levelId = useViewer((state) => state.selection.levelId);
  if (!tool || !isPrismEventPieceType(tool) || !levelId) return null;
  return <PlacePieceTool kind={tool} levelId={levelId} />;
}
