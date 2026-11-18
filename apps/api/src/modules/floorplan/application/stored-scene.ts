import { BadRequestException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import { floorplanSceneDocumentSchema, type FloorplanSceneDocument } from '@prism/types';
import { validateFloorplanScene } from '@prism/floorplan-scene';

/**
 * The Pascal scene stored on a floor plan, or null while the plan has only legacy canvas objects. Scenes are
 * validated when they are saved, so a stored value that does not parse is corrupt data and fails loudly here.
 */
export function storedScene(row: Pick<PrismaFloorPlan, 'scene'>): FloorplanSceneDocument | null {
  return row.scene === null ? null : floorplanSceneDocumentSchema.parse(row.scene);
}

/** A scene a request saves, checked against the editor's rules; the refusal names each issue. */
export function acceptedScene(scene: FloorplanSceneDocument): FloorplanSceneDocument {
  const validation = validateFloorplanScene(scene);
  if (!validation.ok) throw new BadRequestException({ message: 'Floor plan scene is invalid', issues: validation.issues });
  return validation.scene;
}

/** The columns a scene writes: the scene and its format, or nothing when the plan has no scene. */
export function sceneColumns(scene: FloorplanSceneDocument | undefined): { scene?: Prisma.InputJsonValue; sceneFormat?: string } {
  if (!scene) return {};
  return { scene: toPrismaJson(scene), sceneFormat: scene.format };
}
