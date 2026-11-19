import { placeableEventPieceSchemaFor, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";

/** One past the highest table number among the scene's nodes, so a new table never repeats one. */
export function nextTableNumberAmong(nodes: Iterable<unknown>): number {
  let highest = 0;
  for (const node of nodes) {
    const { type, number } = node as { type?: unknown; number?: unknown };
    if (type === "prism-table" && typeof number === "number") highest = Math.max(highest, number);
  }
  return highest + 1;
}

/**
 * The piece a click places: the tile's values at the snapped cursor, on the active level, with a new id. A table is
 * the next table in the room and nobody is seated at it yet.
 */
export function placeNode(
  kind: PrismEventPieceType,
  defaults: Record<string, unknown>,
  position: [number, number, number],
  nodes: Record<string, unknown>,
  levelId: string,
): PrismEventPiece {
  const { id: _id, ...values } = defaults;
  const number = kind === "prism-table" ? nextTableNumberAmong(Object.values(nodes)) : null;
  return placeableEventPieceSchemaFor(kind).parse({
    ...values,
    type: kind,
    parentId: levelId,
    position,
    visible: true,
    ...(number === null ? {} : { number, label: `T${number}`, guestIds: [] }),
  });
}
