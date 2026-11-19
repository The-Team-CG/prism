"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {} from "@react-three/fiber";
import type { Group, Material, Mesh } from "three";
import { emitter, type GridEvent } from "@pascal-app/core";
import { useEditor } from "@pascal-app/editor";
import { useViewer } from "@pascal-app/viewer";
import { isPrismEventPieceType, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { eventShape } from "../symbols/event-shapes";
import { placeNode } from "./place-node";
import { snappedPosition, useArmedPieceValues } from "./piece-placement";

/** A see-through copy of the piece's 3D shape, on its own materials so placed pieces stay solid. */
function ghostOf(piece: PrismEventPiece): Group {
  const ghost = eventShape(piece);
  ghost.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = (mesh.material as Material).clone();
    Object.assign(material, { transparent: true, opacity: 0.45, depthWrite: false });
    mesh.material = material;
  });
  return ghost;
}

function Ghost({ kind, levelId }: { kind: PrismEventPieceType; levelId: string }) {
  const defaults = useArmedPieceValues(kind);
  const ghost = useMemo(() => ghostOf(placeNode(kind, defaults, [0, 0, 0], {}, levelId)), [kind, defaults, levelId]);
  const cursor = useRef<Group>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (event: GridEvent) => {
      cursor.current?.position.set(...snappedPosition(event));
      setVisible(true);
    };
    emitter.on("grid:move", onMove);
    return () => emitter.off("grid:move", onMove);
  }, []);

  return (
    <group ref={cursor} visible={visible}>
      <primitive object={ghost} />
    </group>
  );
}

/**
 * Pascal's 3D tool slot for every PRISM piece: only the ghost that follows the cursor in 3D. Placing is the host's
 * `PiecePlacement`, which also works on a plan opened in 2D.
 */
export default function PlacePieceGhost() {
  const tool = useEditor((state) => state.tool);
  const levelId = useViewer((state) => state.selection.levelId);
  if (!tool || !isPrismEventPieceType(tool) || !levelId) return null;
  return <Ghost kind={tool} levelId={levelId} />;
}
