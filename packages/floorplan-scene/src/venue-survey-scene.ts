import { ColumnNode } from "@pascal-app/core";
import { prismPieceNodeSchema, type FloorplanSceneDocument, type PrismPieceNodeType } from "@prism/types";
import { PASCAL_VERSION, roomScene, withLevelNodes } from "./convert-legacy-plan.js";

export type VenueWall = "north" | "south" | "east" | "west";
export const VENUE_WALLS: VenueWall[] = ["north", "south", "east", "west"];

/** What PMCM measures and notes on an ocular visit (FR-81). Dimensions are metres. */
export interface VenueSurvey {
  widthM: number;
  lengthM: number;
  pillars: number;
  emergencyExits: number;
  doors: number;
  stageWall: VenueWall;
  loadingBayWall: VenueWall | null;
}

/** A fixed feature, placed as a rectangle in metres (x, y is its top-left corner). */
type Fixture = { type: PrismPieceNodeType; variant: string; label?: string; x: number; y: number; w: number; h: number };

const WALL_THICKNESS = 0.2;
const PILLAR_SIZE = 0.6;

/** A fixture of `length` metres set into `wall`, centred at `fraction` (0 to 1) along it. */
function onWall(survey: VenueSurvey, wall: VenueWall, fraction: number, length: number) {
  const horizontal = wall === "north" || wall === "south";
  const span = horizontal ? survey.widthM : survey.lengthM;
  const along = Math.min(Math.max(span * fraction - length / 2, 0), Math.max(span - length, 0));
  if (horizontal) return { x: along, y: wall === "north" ? 0 : survey.lengthM - WALL_THICKNESS, w: length, h: WALL_THICKNESS };
  return { x: wall === "west" ? 0 : survey.widthM - WALL_THICKNESS, y: along, w: WALL_THICKNESS, h: length };
}

/** `count` fixtures spread round the four walls, starting from the wall opposite the stage. */
function spreadOnWalls(survey: VenueSurvey, count: number, variant: string, length: number, offset: number): Fixture[] {
  const opposite: Record<VenueWall, VenueWall> = { north: "south", south: "north", east: "west", west: "east" };
  const start = VENUE_WALLS.indexOf(opposite[survey.stageWall]);
  const perWall = Math.ceil(count / VENUE_WALLS.length);
  return Array.from({ length: count }, (_, index) => {
    const wall = VENUE_WALLS[(start + index) % VENUE_WALLS.length];
    const slot = Math.floor(index / VENUE_WALLS.length);
    return { type: "prism-fixture", variant, ...onWall(survey, wall, (slot + offset) / (perWall + 1), length) };
  });
}

function pillarCentres(survey: VenueSurvey): Array<[number, number]> {
  const columns = Math.ceil(Math.sqrt(survey.pillars));
  const rows = Math.ceil(survey.pillars / Math.max(columns, 1));
  return Array.from({ length: survey.pillars }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return [(survey.widthM * (column + 1)) / (columns + 1), (survey.lengthM * (row + 1)) / (rows + 1)];
  });
}

/**
 * The venue's measured room as a Pascal scene: its perimeter walls, the stage side, loading bay, doors, emergency exits
 * and pillars. Every fixed feature is locked, so a draft from the venue cannot move or delete it.
 */
export function venueSurveyScene(survey: VenueSurvey, name: string): FloorplanSceneDocument {
  const room = roomScene({ name, widthM: survey.widthM, heightM: survey.lengthM }, PASCAL_VERSION);
  const stageLength = Math.min(6, survey.widthM, survey.lengthM);
  const fixtures: Fixture[] = [
    { type: "prism-fixture", variant: "stage-side", label: "Fixed stage side", ...onWall(survey, survey.stageWall, 0.5, stageLength) },
    ...(survey.loadingBayWall ? [{ type: "prism-fixture" as const, variant: "loading-bay", label: "Loading bay", ...onWall(survey, survey.loadingBayWall, 0.85, 3) }] : []),
    ...spreadOnWalls(survey, survey.emergencyExits, "emergency-exit", 1.2, 1),
    ...spreadOnWalls(survey, survey.doors, "door", 1, 0.5),
  ];
  const pieces = fixtures.map((fixture) => prismPieceNodeSchema.parse({
    id: `${fixture.type}_${crypto.randomUUID()}`,
    type: fixture.type,
    parentId: room.levelId,
    visible: true,
    position: [fixture.x + fixture.w / 2, 0, fixture.y + fixture.h / 2],
    rotation: 0,
    width: fixture.w,
    depth: fixture.h,
    supplierIds: [],
    locked: true,
    variant: fixture.variant,
    ...(fixture.label === undefined ? {} : { label: fixture.label }),
  }));
  const columns = pillarCentres(survey).map(([x, z]) => ColumnNode.parse({
    parentId: room.levelId,
    visible: true,
    position: [x, 0, z],
    rotation: 0,
    crossSection: "rectangular",
    width: PILLAR_SIZE,
    depth: PILLAR_SIZE,
    radius: PILLAR_SIZE / 2,
  }));
  return withLevelNodes(room.scene, room.levelId, [...pieces, ...columns]);
}
