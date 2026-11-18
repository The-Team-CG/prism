import { BadRequestException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import { floorplanSceneDocumentSchema, type FloorplanSceneDocument } from '@prism/types';
import { validateFloorplanScene } from '@prism/floorplan-scene';

/**
 * The Pascal scene stored on a floor plan. Every plan has one: legacy plans were converted before the legacy columns
 * were dropped, so a missing or unreadable scene is corrupt data and fails loudly here.
 */
export function storedScene(row: Pick<PrismaFloorPlan, 'scene'>): FloorplanSceneDocument {
  if (row.scene === null) throw new Error('Floor plan has no scene; run npm --workspace prism-api run db:convert:floorplans');
  return floorplanSceneDocumentSchema.parse(row.scene);
}

/** A scene a request saves, checked against the editor's rules; the refusal names each issue. */
export function acceptedScene(scene: FloorplanSceneDocument): FloorplanSceneDocument {
  const validation = validateFloorplanScene(scene);
  if (!validation.ok) throw new BadRequestException({ message: 'Floor plan scene is invalid', issues: validation.issues });
  return validation.scene;
}

/** The columns a scene writes: the scene and its format. */
export function sceneColumns(scene: FloorplanSceneDocument): { scene: Prisma.InputJsonValue; sceneFormat: string } {
  return { scene: toPrismaJson(scene), sceneFormat: scene.format };
}
