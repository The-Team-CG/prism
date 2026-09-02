import type { Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import type { CanvasObject } from '@prism/kernel/shared';

export function setIfDefined(
  data: Record<string, unknown>,
  key: string,
  value: unknown,
  map?: (value: unknown) => unknown,
) {
  if (value === undefined) return;
  data[key] = map ? map(value) : value;
}

export function jsonIfDefined(data: Record<string, unknown>, key: string, value: unknown) {
  setIfDefined(data, key, value, (item) => toPrismaJson(item));
}

export type FloorPlanPatchInput = {
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  guests?: unknown[];
  suppliers?: unknown[];
  seats?: unknown;
  seatCategories?: unknown;
  objects?: unknown;
};

export function floorPlanScalarPatch(changes: FloorPlanPatchInput): Prisma.FloorPlanUpdateInput {
  const data: Record<string, unknown> = {};
  setIfDefined(data, 'width', changes.width);
  setIfDefined(data, 'height', changes.height);
  setIfDefined(data, 'gridSize', changes.gridSize);
  setIfDefined(data, 'venue', changes.venue);
  setIfDefined(data, 'pax', changes.pax);
  jsonIfDefined(data, 'guests', changes.guests);
  jsonIfDefined(data, 'suppliers', changes.suppliers);
  jsonIfDefined(data, 'seats', changes.seats);
  jsonIfDefined(data, 'seatCategories', changes.seatCategories);
  jsonIfDefined(data, 'objects', changes.objects);
  return data as Prisma.FloorPlanUpdateInput;
}

export async function replaceFloorPlanObjects(
  tx: Pick<Prisma.TransactionClient, 'floorPlanObject'>,
  floorPlanId: string,
  objects: CanvasObject[],
) {
  await tx.floorPlanObject.deleteMany({ where: { floorPlanId } });
  if (objects.length === 0) return;
  await tx.floorPlanObject.createMany({
    data: objects.map((object, index) => ({
      floorPlanId,
      objectId: object.id,
      kind: object.kind,
      zIndex: object.zIndex ?? index,
      objectData: toPrismaJson(object),
      svgMarkup: object.svgMarkup ?? null,
    })),
  });
}
