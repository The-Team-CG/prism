import {
  isPrismEventPieceType,
  prismEventPieceSchemaFor,
  prismPullSheetGroups,
  type FloorplanSceneDocument,
  type PrismEventPiece,
  type PrismPullSheetGroup,
  type PrismPullSheetLine,
  type PrismSeatingBlockNode,
  type PrismTableNode,
} from "@prism/types";
import { isHiddenInScene } from "./scene-visibility.js";

/** A banquet run's depth, for counting the runs a U or hollow square is made of. */
const RUN_DEPTH_M = 0.75;

const WORDS: Record<string, string> = { led: "LED", foh: "FOH", av: "AV", l: "L" };

/** A variant or field value as words: "led-wall" → "LED wall", "cross-back" → "Cross back". */
export function displayName(value: string): string {
  const words = value.split(/[-_\s]+/).filter(Boolean).map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase());
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

const metres = (value: number) => `${Math.round(value * 100) / 100} m`;
const size = (width: number, depth: number) => `${Math.round(width * 100) / 100} × ${metres(depth)}`;

type Tally = Map<string, PrismPullSheetLine>;

function add(tally: Tally, group: PrismPullSheetGroup, item: string, quantity: number, unit: PrismPullSheetLine["unit"] = "pcs") {
  if (quantity <= 0) return;
  const key = `${group}\u0000${item}`;
  const line = tally.get(key);
  tally.set(key, { group, item, unit, quantity: (line?.quantity ?? 0) + quantity });
}

/** How many runs of table a table is: one, or the three or four runs of a U or hollow square. */
const runsOf = (table: PrismTableNode) => (table.shape === "u-shape" ? 3 : table.shape === "hollow-square" ? 4 : 1);

const TABLE_NAMES: Record<PrismTableNode["shape"], (table: PrismTableNode) => string> = {
  round: (table) => `Round table ${metres(table.width)}`,
  cocktail: (table) => `Cocktail table ${metres(table.width)}`,
  rect: (table) => `Banquet table ${size(table.width, table.depth)}`,
  "u-shape": (table) => `U-shape ${size(table.width, table.depth)} (3 banquet runs, ${metres(RUN_DEPTH_M)} deep)`,
  "hollow-square": (table) => `Hollow square ${size(table.width, table.depth)} (4 banquet runs, ${metres(RUN_DEPTH_M)} deep)`,
};

const LINEN_FITS: Record<PrismTableNode["shape"], (table: PrismTableNode) => string> = {
  round: (table) => `round ${metres(table.width)}, to the floor`,
  cocktail: (table) => `cocktail stretch cover ${metres(table.width)}`,
  rect: (table) => `banquet ${size(table.width, table.depth)}, fitted`,
  "u-shape": () => "banquet run, fitted",
  "hollow-square": () => "banquet run, fitted",
};

/** A table: the table, its chairs and sashes, its linens, overlay or runners, centrepieces and number stand. */
function tallyTable(tally: Tally, table: PrismTableNode) {
  const runs = runsOf(table);
  add(tally, "Tables", TABLE_NAMES[table.shape](table), 1);
  add(tally, "Chairs", `${displayName(table.chairStyle)} chairs`, table.seats);
  if (table.sash && table.sash !== "none") add(tally, "Linens & dressing", `${displayName(table.sash)} sashes`, table.seats);
  add(tally, "Linens & dressing", `${displayName(table.linen)} linen, ${LINEN_FITS[table.shape](table)}`, runs);
  if (table.overlay && table.overlay !== "none") {
    const accent = table.shape === "round" ? "overlay" : table.shape === "cocktail" ? "waist band" : "runner";
    add(tally, "Linens & dressing", `${displayName(table.overlay)} ${accent}`, runs);
  }
  if (table.centerpiece && table.centerpiece !== "none" && table.shape !== "cocktail") add(tally, "Linens & dressing", `Centerpiece: ${table.centerpiece}`, runs);
  if (table.number !== undefined && table.shape !== "cocktail") add(tally, "Linens & dressing", "Table number stands", 1);
}

function tallyBlock(tally: Tally, block: PrismSeatingBlockNode) {
  add(tally, "Chairs", `${displayName(block.chairStyle)} chairs`, block.rows * block.columns);
  if (block.style === "classroom") add(tally, "Tables", `Classroom desk run ${metres(block.width)}`, block.rows);
  if (block.style === "ceremony" && block.aisle > 0) add(tally, "Linens & dressing", "Aisle runner", block.depth + 1, "m");
}

/** The group a plain piece's kind is listed under. */
const KIND_GROUPS: Partial<Record<PrismEventPiece["type"], PrismPullSheetGroup>> = {
  "prism-stage": "Stage & floor",
  "prism-catering": "Food & bar",
  "prism-av": "AV & lighting",
  "prism-decor": "Décor",
  "prism-registration": "Structures & services",
  "prism-booth": "Structures & services",
  "prism-fixture": "Structures & services",
  "prism-safety": "Safety & guest flow",
};

function tallyPiece(tally: Tally, piece: PrismEventPiece) {
  switch (piece.type) {
    case "prism-table":
      return tallyTable(tally, piece);
    case "prism-seating-block":
      return tallyBlock(tally, piece);
    case "prism-dance-floor":
      return add(tally, "Stage & floor", `${displayName(piece.finish)} dance floor`, piece.width * piece.depth, "m²");
    case "prism-bar":
      add(tally, "Food & bar", `${piece.shape === "l" ? "L bar" : "Bar counter"} ${size(piece.width, piece.depth)}`, 1);
      add(tally, "Food & bar", "Bar stools", piece.stools);
      return piece.backBar ? add(tally, "Food & bar", `Back bar ${metres(piece.width)}`, 1) : undefined;
    case "prism-zone":
    case "prism-shape":
    case "prism-seat":
      return undefined;
    default:
      return tallyPlain(tally, piece);
  }
}

/** A stage with its steps and backdrop, or any other piece by its name and size. */
function tallyPlain(tally: Tally, piece: Extract<PrismEventPiece, { variant: string }>) {
  const group = KIND_GROUPS[piece.type] ?? "Structures & services";
  if (piece.type === "prism-stage" && piece.variant === "stage") {
    add(tally, group, `Stage deck ${size(piece.width, piece.depth)}, ${metres(piece.heightM ?? 0.6)} high`, 1);
    if (piece.steps) add(tally, group, "Stage steps with handrails", 1);
    if (piece.backdrop) add(tally, group, `Truss backdrop ${metres(piece.width)}`, 1);
    return;
  }
  add(tally, group, `${piece.label?.trim() || displayName(piece.variant)} ${size(piece.width, piece.depth)}`, 1);
}

/**
 * What the plan needs brought in: every visible piece counted by what a supplier pulls from stock, so 25 round tables,
 * 250 chiavari chairs and 25 ivory linens come out as three lines. Lines are in pull-sheet group order, then by item.
 * Zones and drawn shapes are not things anyone brings, so they are left out; so is anything hidden on the plan.
 */
export function pullSheet(scene: FloorplanSceneDocument): PrismPullSheetLine[] {
  const tally: Tally = new Map();
  for (const node of Object.values(scene.nodes)) {
    if (!isPrismEventPieceType(node.type) || isHiddenInScene(scene, node.id)) continue;
    tallyPiece(tally, prismEventPieceSchemaFor(node.type).parse(node) as PrismEventPiece);
  }
  const order = (group: PrismPullSheetGroup) => prismPullSheetGroups.indexOf(group);
  return [...tally.values()].sort((a, b) => order(a.group) - order(b.group) || a.item.localeCompare(b.item, undefined, { numeric: true }));
}
