"use client";

import { useMemo } from "react";
import { useScene } from "@pascal-app/core";
import type { FloorplanSceneDocument } from "@prism/types";
import { PASCAL_VERSION, toSceneDocument } from "../scene-document";

/** The live scene as stored. Pascal commits a node change once a drag ends, so this reparses per edit, not per frame. */
export function useLiveScene(): FloorplanSceneDocument {
  const nodes = useScene((state) => state.nodes);
  const rootNodeIds = useScene((state) => state.rootNodeIds);
  return useMemo(() => toSceneDocument({ nodes, rootNodeIds }, PASCAL_VERSION), [nodes, rootNodeIds]);
}
