import type { FloorPlan as PrismaFloorPlan } from '@prisma/client';
import { floorplanSceneDocumentSchema, type FloorplanSceneDocument } from '@prism/types';

/**
 * The Pascal scene stored on a floor plan, or null while the plan has only legacy canvas objects. Scenes are
 * validated when they are saved, so a stored value that does not parse is corrupt data and fails loudly here.
 */
export function storedScene(row: Pick<PrismaFloorPlan, 'scene'>): FloorplanSceneDocument | null {
  return row.scene === null ? null : floorplanSceneDocumentSchema.parse(row.scene);
}
