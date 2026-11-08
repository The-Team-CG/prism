import { ASSETS, uid } from "./assetLibrary";
import type { CanvasObject } from "./types";

export type VenueWall = "north" | "south" | "east" | "west";
export const VENUE_WALLS: VenueWall[] = ["north", "south", "east", "west"];

/** What PMCM measures and notes on an ocular visit (FR-81). Dimensions are meters. */
export interface VenueSurvey {
  widthM: number;
  lengthM: number;
  pillars: number;
  emergencyExits: number;
  doors: number;
  stageWall: VenueWall;
  loadingBayWall: VenueWall | null;
}

const WALL_THICKNESS = 0.2;

function fixture(assetId: string, rect: { x: number; y: number; w: number; h: number }, label?: string): CanvasObject {
  const asset = ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Unknown asset ${assetId}`);
  return {
    id: uid(assetId), name: label ?? asset.name, kind: asset.kind, category: asset.category,
    ...rect, rotation: 0, fill: asset.fill, stroke: asset.stroke, strokeWidth: 0.04,
    label, locked: true, hidden: false,
  };
}

/** A fixture of `length` meters set into `wall`, centered at `fraction` (0 to 1) along it. */
function onWall(survey: VenueSurvey, wall: VenueWall, fraction: number, length: number) {
  const horizontal = wall === "north" || wall === "south";
  const span = horizontal ? survey.widthM : survey.lengthM;
  const along = Math.min(Math.max(span * fraction - length / 2, 0), Math.max(span - length, 0));
  if (horizontal) return { x: along, y: wall === "north" ? 0 : survey.lengthM - WALL_THICKNESS, w: length, h: WALL_THICKNESS };
  return { x: wall === "west" ? 0 : survey.widthM - WALL_THICKNESS, y: along, w: WALL_THICKNESS, h: length };
}

/** Spreads `count` fixtures round the four walls, starting from the wall opposite the stage. */
function spreadOnWalls(survey: VenueSurvey, count: number, assetId: string, length: number, offset: number) {
  const opposite: Record<VenueWall, VenueWall> = { north: "south", south: "north", east: "west", west: "east" };
  const start = VENUE_WALLS.indexOf(opposite[survey.stageWall]);
  const objects: CanvasObject[] = [];
  for (let index = 0; index < count; index += 1) {
    const wall = VENUE_WALLS[(start + index) % VENUE_WALLS.length];
    const perWall = Math.ceil(count / VENUE_WALLS.length);
    const slot = Math.floor(index / VENUE_WALLS.length);
    objects.push(fixture(assetId, onWall(survey, wall, (slot + offset) / (perWall + 1), length)));
  }
  return objects;
}

function pillarGrid(survey: VenueSurvey) {
  const columns = Math.ceil(Math.sqrt(survey.pillars));
  const rows = Math.ceil(survey.pillars / Math.max(columns, 1));
  const objects: CanvasObject[] = [];
  for (let index = 0; index < survey.pillars; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (survey.widthM * (column + 1)) / (columns + 1) - 0.3;
    const y = (survey.lengthM * (row + 1)) / (rows + 1) - 0.3;
    objects.push(fixture("pillar", { x, y, w: 0.6, h: 0.6 }));
  }
  return objects;
}

/** Turns an ocular survey into the venue's permanent features: perimeter walls, pillars, exits, doors, stage side and loading bay. All come back locked. */
export function venueSurveyFixtures(survey: VenueSurvey): CanvasObject[] {
  const walls = VENUE_WALLS.map((wall) => fixture("wall", onWall(survey, wall, 0.5, wall === "north" || wall === "south" ? survey.widthM : survey.lengthM), `${wall[0].toUpperCase()}${wall.slice(1)} wall`));
  const stage = fixture("window", onWall(survey, survey.stageWall, 0.5, Math.min(6, survey.widthM, survey.lengthM)), "Fixed stage side");
  const loadingBay = survey.loadingBayWall ? [fixture("door", onWall(survey, survey.loadingBayWall, 0.85, 3), "Loading bay")] : [];
  return [
    ...walls,
    stage,
    ...loadingBay,
    ...pillarGrid(survey),
    ...spreadOnWalls(survey, survey.emergencyExits, "emergency-exit", 1.2, 1),
    ...spreadOnWalls(survey, survey.doors, "door", 1, 0.5),
  ];
}
