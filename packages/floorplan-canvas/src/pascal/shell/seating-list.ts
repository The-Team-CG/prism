import { tableAssignmentsOf, type SceneTableAssignment } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument, PrismFloorplanSeatingGuest } from "@prism/types";

export interface SeatingListRow {
  table: string;
  seats: number;
  guests: string[];
}

export interface SeatingList {
  rows: SeatingListRow[];
  /** Guests who have not declined and have no table yet. */
  unseated: string[];
  totalSeated: number;
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** A table's name on the list: its label, else its number, else a plain fallback. */
function tableName(scene: FloorplanSceneDocument, table: SceneTableAssignment): string {
  const node = scene.nodes[table.tableId] as { label?: unknown; number?: unknown };
  if (typeof node.label === "string" && node.label.trim()) return node.label;
  return typeof node.number === "number" ? `T${node.number}` : "Table";
}

/** Who sits where: one row per visible table with its guests by name, and the guests still without a table. */
export function buildSeatingList(scene: FloorplanSceneDocument, guests: readonly PrismFloorplanSeatingGuest[]): SeatingList {
  const names = new Map(guests.map((guest) => [guest.id, guest.name]));
  const seatedIds = new Set<string>();
  const rows = tableAssignmentsOf(scene)
    .filter((table) => !table.hidden)
    .map((table): SeatingListRow => {
      const seated = table.guestIds
        .filter((id) => names.has(id))
        .map((id) => {
          seatedIds.add(id);
          return names.get(id) as string;
        })
        .sort(compareNames);
      return { table: tableName(scene, table), seats: table.seats, guests: seated };
    })
    .sort((left, right) => compareNames(left.table, right.table));
  const unseated = guests
    .filter((guest) => guest.rsvp !== "declined" && !seatedIds.has(guest.id))
    .map((guest) => guest.name)
    .sort(compareNames);
  return { rows, unseated, totalSeated: seatedIds.size };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A self-contained, print-ready page; every name is escaped because guest names are typed by people. */
export function seatingListHtml(title: string, list: SeatingList): string {
  const tables = list.rows
    .map(
      (row) =>
        `<section><h2>${escapeHtml(row.table)} <small>${row.guests.length} of ${row.seats} seats</small></h2>` +
        (row.guests.length > 0 ? `<ol>${row.guests.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ol>` : "<p>No guests seated.</p>") +
        "</section>",
    )
    .join("");
  const unseated =
    list.unseated.length > 0 ? `<section><h2>Not yet seated</h2><ul>${list.unseated.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul></section>` : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    "<style>body{font-family:system-ui,sans-serif;margin:24px;color:#171216}h1{font-size:20px}h2{font-size:15px;margin:0 0 4px}small{font-weight:400;color:#6b6b6b}" +
    "section{break-inside:avoid;margin:0 0 16px}ol,ul{margin:0;padding-left:20px;columns:2}</style></head><body>" +
    `<h1>${escapeHtml(title)}</h1><p>${list.totalSeated} guest${list.totalSeated === 1 ? "" : "s"} seated at ${list.rows.length} table${list.rows.length === 1 ? "" : "s"}.</p>` +
    tables +
    unseated +
    "</body></html>"
  );
}

/** Opens the seating list in its own window and prints it. Returns false when the browser blocked the window. */
export function printSeatingList(title: string, list: SeatingList): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(seatingListHtml(title, list));
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
