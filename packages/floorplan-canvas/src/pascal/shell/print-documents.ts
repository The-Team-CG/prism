import type { FloorplanGeometry } from "@pascal-app/core";
import { isHiddenInScene, planDrawing, pullSheet } from "@prism/floorplan-scene";
import { isPrismEventPieceType, prismEventPieceSchemaFor, prismPullSheetGroups, type FloorplanSceneDocument, type PrismEventPiece, type PrismPullSheetLine } from "@prism/types";
import { eventSymbol } from "../symbols";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Opens a print-ready page in its own window and prints it. Returns false when the browser blocked the window. */
export function printHtml(html: string): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

const PAGE_STYLE =
  "body{font-family:system-ui,sans-serif;margin:24px;color:#171216}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:16px 0 4px}" +
  "p{margin:0 0 12px;color:#4b5563}table{border-collapse:collapse;width:100%;font-size:13px}td{padding:3px 6px;border-bottom:1px solid #e5e7eb}" +
  "td.qty{text-align:right;white-space:nowrap;width:1%;font-variant-numeric:tabular-nums}section{break-inside:avoid}";

const page = (title: string, body: string, landscape = false) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PAGE_STYLE}${landscape ? "@page{size:landscape}" : ""}</style></head><body>${body}</body></html>`;

const quantity = ({ quantity, unit }: PrismPullSheetLine) => (unit === "pcs" ? String(quantity) : `${Math.round(quantity * 10) / 10} ${unit}`);

/** The pull sheet's lines as one table per group. */
function pullSheetSections(lines: PrismPullSheetLine[]): string {
  return prismPullSheetGroups
    .map((group) => {
      const rows = lines.filter((line) => line.group === group);
      if (rows.length === 0) return "";
      const body = rows.map((line) => `<tr><td>${escapeHtml(line.item)}</td><td class="qty">${escapeHtml(quantity(line))}</td></tr>`).join("");
      return `<section><h2>${escapeHtml(group)}</h2><table>${body}</table></section>`;
    })
    .join("");
}

/** A print-ready pull sheet: everything the plan needs brought in, by group. Item names may carry typed labels, so they are escaped. */
export function pullSheetHtml(title: string, scene: FloorplanSceneDocument): string {
  const lines = pullSheet(scene);
  const intro = lines.length === 0 ? "<p>Nothing is placed on the plan yet.</p>" : "<p>Everything placed on the plan, counted for the suppliers who bring it.</p>";
  return page(`${title} · Pull sheet`, `<h1>${escapeHtml(title)} · Pull sheet</h1>${intro}${pullSheetSections(lines)}`);
}

/* ── The plan as SVG ───────────────────────────────────────────── */

const ATTRIBUTES: Record<string, string> = {
  fillOpacity: "fill-opacity",
  strokeWidth: "stroke-width",
  strokeDasharray: "stroke-dasharray",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  fontSize: "font-size",
  fontWeight: "font-weight",
  textAnchor: "text-anchor",
  dominantBaseline: "dominant-baseline",
};
const DRAWN = new Set(["x", "y", "width", "height", "rx", "cx", "cy", "r", "x1", "y1", "x2", "y2", "fill", "stroke", ...Object.keys(ATTRIBUTES)]);

function attributes(shape: Record<string, unknown>): string {
  return Object.entries(shape)
    .filter(([key, value]) => DRAWN.has(key) && (typeof value === "string" || typeof value === "number"))
    .map(([key, value]) => `${ATTRIBUTES[key] ?? key}="${escapeHtml(String(value))}"`)
    .join(" ");
}

const transformOf = (transform: { translate?: [number, number]; rotate?: number } | undefined) =>
  transform ? `${transform.translate ? `translate(${transform.translate.join(" ")})` : ""}${transform.rotate ? ` rotate(${(transform.rotate * 180) / Math.PI})` : ""}` : "";

/** One of the plan geometries event symbols are drawn with, as SVG. */
export function geometrySvg(geometry: FloorplanGeometry): string {
  const shape = geometry as FloorplanGeometry & Record<string, unknown>;
  switch (geometry.kind) {
    case "group":
      return `<g transform="${transformOf(geometry.transform as never)}">${geometry.children.map(geometrySvg).join("")}</g>`;
    case "polygon":
      return `<polygon points="${(shape.points as Array<[number, number]>).map((point) => point.join(",")).join(" ")}" ${attributes(shape)}/>`;
    case "text":
      return `<text ${attributes(shape)}>${escapeHtml(String(shape.text))}</text>`;
    case "rect":
    case "circle":
    case "line":
      return `<${geometry.kind} ${attributes(shape)}/>`;
    default:
      return "";
  }
}

/** Every visible event piece on the plan. */
function visiblePieces(scene: FloorplanSceneDocument): PrismEventPiece[] {
  return Object.values(scene.nodes).flatMap((node) =>
    isPrismEventPieceType(node.type) && !isHiddenInScene(scene, node.id) ? [prismEventPieceSchemaFor(node.type).parse(node) as PrismEventPiece] : [],
  );
}

const MARGIN_M = 1.5;

/** The plan drawn as it is in the editor: its walls and every piece's symbol, in metres, with a 5 m scale bar. */
export function planSvg(scene: FloorplanSceneDocument): string {
  const { room, walls } = planDrawing(scene);
  const [x, y, w, h] = [room.minX - MARGIN_M, room.minY - MARGIN_M, room.width + 2 * MARGIN_M, room.depth + 2 * MARGIN_M];
  const wallLines = walls.map((wall) => `<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" stroke="#1f2937" stroke-width="0.2" stroke-linecap="square"/>`).join("");
  const pieces = visiblePieces(scene).map((piece) => geometrySvg(eventSymbol(piece, "Piece"))).join("");
  const scaleY = room.minY + room.depth + MARGIN_M * 0.6;
  const scale = `<g><line x1="${room.minX}" y1="${scaleY}" x2="${room.minX + 5}" y2="${scaleY}" stroke="#1f2937" stroke-width="0.06"/><text x="${room.minX + 5.3}" y="${scaleY}" font-size="0.45" dominant-baseline="central" fill="#1f2937">5 m</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" style="width:100%;max-height:70vh">${wallLines}${pieces}${scale}</svg>`;
}

/** A print-ready floor plan: the drawing, its room size, and what it needs brought in. */
export function planHtml(title: string, scene: FloorplanSceneDocument): string {
  const { room } = planDrawing(scene);
  const size = `Room ${Math.round(room.width * 10) / 10} × ${Math.round(room.depth * 10) / 10} m`;
  return page(`${title} · Floor plan`, `<h1>${escapeHtml(title)}</h1><p>${size}</p>${planSvg(scene)}<h2>What the plan needs</h2>${pullSheetSections(pullSheet(scene))}`, true);
}
