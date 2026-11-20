import type { Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import type { UpdatePlanInput } from '@prism/types';

export function setIfDefined(
  data: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value === undefined) return;
  data[key] = value;
}

export type FloorPlanPatchInput = Pick<UpdatePlanInput, 'venue' | 'width' | 'height' | 'gridSize' | 'pax' | 'scene'>;

const PLAIN_PATCH_FIELDS = ['width', 'height', 'gridSize', 'venue', 'pax'] as const;

export function floorPlanScalarPatch(changes: FloorPlanPatchInput): Prisma.FloorPlanUpdateInput {
  const data: Record<string, unknown> = {};
  for (const field of PLAIN_PATCH_FIELDS) {
    if (changes[field] !== undefined) data[field] = changes[field];
  }
  if (changes.scene !== undefined) {
    data.scene = toPrismaJson(changes.scene);
    data.sceneFormat = changes.scene.format;
  }
  return data as Prisma.FloorPlanUpdateInput;
}
