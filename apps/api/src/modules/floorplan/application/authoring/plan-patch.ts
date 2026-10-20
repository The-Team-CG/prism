import type { Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import type { SavedPlanObject } from '@prism/kernel/shared';
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

const PLAIN_PATCH_FIELDS = ['width', 'height', 'gridSize', 'venue', 'pax'] as const;
const JSON_PATCH_FIELDS = ['guests', 'suppliers', 'seats', 'seatCategories', 'objects'] as const;

export function floorPlanScalarPatch(changes: FloorPlanPatchInput): Prisma.FloorPlanUpdateInput {
  const data: Record<string, unknown> = {};
  for (const field of PLAIN_PATCH_FIELDS) {
    if (changes[field] !== undefined) data[field] = changes[field];
  }
  for (const field of JSON_PATCH_FIELDS) {
    if (changes[field] !== undefined) data[field] = toPrismaJson(changes[field]);
  }
  return data as Prisma.FloorPlanUpdateInput;
}

export async function replaceFloorPlanObjects(
  tx: Pick<Prisma.TransactionClient, 'floorPlanObject'>,
  floorPlanId: string,
  objects: readonly SavedPlanObject[],
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
