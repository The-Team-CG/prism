import type { Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import type { CanvasObject } from '@prism/kernel/shared';
import type { CreateFloorPlanDraftInput, UpdatePlanInput } from '@prism/types';

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

export type FloorPlanPatchInput =
  Pick<CreateFloorPlanDraftInput, 'venue' | 'width' | 'height' | 'gridSize' | 'pax' | 'guests' | 'suppliers' | 'objects'>
  & Pick<UpdatePlanInput, 'seats' | 'seatCategories'>;

export function floorPlanScalarPatch(changes: FloorPlanPatchInput): Prisma.FloorPlanUpdateInput {
  const data: Prisma.FloorPlanUpdateInput = {};
  if (changes.width !== undefined) data.width = changes.width;
  if (changes.height !== undefined) data.height = changes.height;
  if (changes.gridSize !== undefined) data.gridSize = changes.gridSize;
  if (changes.venue !== undefined) data.venue = changes.venue;
  if (changes.pax !== undefined) data.pax = changes.pax;
  if (changes.guests !== undefined) data.guests = toPrismaJson(changes.guests);
  if (changes.suppliers !== undefined) data.suppliers = toPrismaJson(changes.suppliers);
  if (changes.seats !== undefined) data.seats = toPrismaJson(changes.seats);
  if (changes.seatCategories !== undefined) data.seatCategories = toPrismaJson(changes.seatCategories);
  if (changes.objects !== undefined) data.objects = toPrismaJson(changes.objects);
  return data;
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
