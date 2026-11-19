import type { FloorplanSceneDocument } from "@prism/types";

type NodeInput = { id: string; type: string; parentId: string | null; [field: string]: unknown };

/** A site → building → level scene holding the given nodes under the level. */
export function sceneWith(levelChildren: NodeInput[], options: { levelVisible?: boolean } = {}): FloorplanSceneDocument {
  const nodes: FloorplanSceneDocument["nodes"] = {
    site_1: { id: "site_1", type: "site", parentId: null, visible: true, children: ["building_1"] },
    building_1: { id: "building_1", type: "building", parentId: "site_1", visible: true, children: ["level_1"] },
    level_1: { id: "level_1", type: "level", parentId: "building_1", visible: options.levelVisible ?? true, children: levelChildren.map((node) => node.id) },
  };
  for (const node of levelChildren) nodes[node.id] = { visible: true, ...node };
  return { format: "pascal-v1", pascalVersion: "1.1.6", nodes, rootNodeIds: ["site_1"] };
}

export function table(id: string, fields: { seats?: number; guestIds?: string[]; visible?: boolean } = {}): NodeInput {
  return {
    id,
    type: "prism-table",
    parentId: "level_1",
    shape: "round",
    position: [2, 0, 3],
    rotation: 0,
    width: 1.8,
    depth: 1.8,
    seats: fields.seats ?? 10,
    guestIds: fields.guestIds ?? [],
    ...(fields.visible === undefined ? {} : { visible: fields.visible }),
  };
}
