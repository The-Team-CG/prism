import {
  floorplanSceneDocumentSchema,
  isPrismEventPieceType,
  prismEventPieceSchemaFor,
  type FloorplanSceneDocument,
} from "@prism/types";

/** Upper bounds for one saved floor plan; a real event room stays far below both. */
export const SCENE_LIMITS = { maxNodes: 5000, maxBytes: 2_000_000 } as const;

export type SceneValidation = { ok: true; scene: FloorplanSceneDocument } | { ok: false; issues: string[] };

type ParsedPiece = { node: FloorplanSceneDocument["nodes"][string] } | { issue: string } | null;

/** A PRISM event piece parsed with its own schema; null for Pascal's nodes, an issue for a broken or unknown piece. */
function parseEventPiece(id: string, node: { type: string }): ParsedPiece {
  if (!node.type.startsWith("prism-")) return null;
  if (!isPrismEventPieceType(node.type)) return { issue: `Node ${id} is an unknown event piece (${node.type})` };
  const parsed = prismEventPieceSchemaFor(node.type).safeParse(node);
  if (parsed.success) return { node: parsed.data };
  return { issue: `Node ${id} is not a valid ${node.type}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}` };
}

/**
 * Checks a scene before it is stored or acted on. The API runs this on every save, so a scene that
 * would not reload in the editor, or that hides seating outside the event-piece schemas, never lands.
 */
export function validateFloorplanScene(input: unknown): SceneValidation {
  const parsed = floorplanSceneDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "scene"}: ${issue.message}`) };
  }

  const scene = parsed.data;
  const ids = Object.keys(scene.nodes);
  if (ids.length > SCENE_LIMITS.maxNodes) {
    return { ok: false, issues: [`Scene has too many nodes (${ids.length}; the limit is ${SCENE_LIMITS.maxNodes})`] };
  }
  const bytes = JSON.stringify(input).length;
  if (bytes > SCENE_LIMITS.maxBytes) {
    return { ok: false, issues: [`Scene is too large (${bytes} bytes; the limit is ${SCENE_LIMITS.maxBytes})`] };
  }

  const issues: string[] = [];
  const nodes: FloorplanSceneDocument["nodes"] = {};
  for (const id of ids) {
    const node = scene.nodes[id]!;
    if (node.id !== id) issues.push(`Node ${id} is stored under a different id (${node.id})`);
    if (node.parentId !== null && !(node.parentId in scene.nodes)) issues.push(`Node ${id} has a missing parent ${node.parentId}`);
    const piece = parseEventPiece(id, node);
    if (piece && "issue" in piece) issues.push(piece.issue);
    else nodes[id] = piece ? piece.node : node;
  }
  for (const rootId of scene.rootNodeIds) {
    const root = scene.nodes[rootId];
    if (!root) issues.push(`Root ${rootId} is not in the scene`);
    else if (root.parentId !== null) issues.push(`Root ${rootId} has a parent`);
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, scene: { ...scene, nodes } };
}
