import type { FloorplanSceneDocument } from "@prism/types";

/** A node is hidden when it, or any node above it, is not visible. Cycles stop the walk rather than loop. */
export function isHiddenInScene(scene: FloorplanSceneDocument, id: string): boolean {
  const seen = new Set<string>();
  for (
    let node: FloorplanSceneDocument["nodes"][string] | undefined = scene.nodes[id];
    node && !seen.has(node.id);
    node = node.parentId ? scene.nodes[node.parentId] : undefined
  ) {
    if (node.visible === false) return true;
    seen.add(node.id);
  }
  return false;
}
