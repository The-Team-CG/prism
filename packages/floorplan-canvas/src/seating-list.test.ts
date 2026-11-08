import { describe, expect, it } from "vitest";
import { buildSeatingList, seatingListHtml } from "./seating-list";
import type { CanvasObject, Guest } from "./types";

const table = (overrides: Partial<CanvasObject>): CanvasObject => ({
  id: "t",
  name: "Round Banquet",
  kind: "ellipse",
  category: "furniture",
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  rotation: 0,
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 1,
  seats: 10,
  assignedGuestIds: [],
  locked: false,
  hidden: false,
  ...overrides,
});

const guest = (id: string, name: string, rsvp: Guest["rsvp"] = "confirmed"): Guest => ({ id, name, rsvp }) as Guest;

describe("buildSeatingList", () => {
  const project = {
    objects: [
      table({ id: "t10", label: "Table 10", assignedGuestIds: ["g2", "g1"] }),
      table({ id: "t2", label: "Table 2", assignedGuestIds: ["g3"] }),
      table({ id: "hidden", label: "Table 99", hidden: true, assignedGuestIds: ["g9"] }),
      table({ id: "stage", category: "stage", seats: undefined, label: "Stage" }),
      table({ id: "empty", label: "Table 3", assignedGuestIds: ["ghost"] }),
    ],
    guests: [guest("g1", "Zed Lim"), guest("g2", "Ana Cruz"), guest("g3", "Ben Tan"), guest("g4", "Cara Uy"), guest("g5", "Dan Ng", "declined"), guest("g9", "Hidden Table Guest")],
    pax: 120,
    eventPrivacy: "private" as const,
  };

  it("lists visible seating tables in natural order with their guests by name", () => {
    const list = buildSeatingList(project)!;

    expect(list.rows.map((row) => row.table)).toEqual(["Table 2", "Table 3", "Table 10"]);
    expect(list.rows[2]).toEqual({ table: "Table 10", seats: 10, guests: ["Ana Cruz", "Zed Lim"] });
    expect(list.rows[1].guests).toEqual([]);
  });

  it("leaves out declined guests from the not-yet-seated list and counts only guests who are listed at a table", () => {
    const list = buildSeatingList(project)!;

    expect(list.unseated).toEqual(["Cara Uy", "Hidden Table Guest"]);
    expect(list.totalSeated).toBe(3);
  });
});

describe("buildSeatingList availability", () => {
  const base = { objects: [table({ id: "t1", label: "Table 1", assignedGuestIds: [] })], guests: [guest("g1", "Ana")] };

  it("produces no list for a public event or an event of 200 guests or more", () => {
    expect(buildSeatingList({ ...base, pax: 120, eventPrivacy: "public" })).toBeNull();
    expect(buildSeatingList({ ...base, pax: 200, eventPrivacy: "private" })).toBeNull();
  });
});

describe("seatingListHtml", () => {
  it("escapes guest and table names and states the seated count", () => {
    const html = seatingListHtml("Gala <seating>", {
      rows: [{ table: "Table <1>", seats: 2, guests: ['Ana "Bud" & Co'] }],
      unseated: ["<script>alert(1)</script>"],
      totalSeated: 1,
    });

    expect(html).toContain("<title>Gala &lt;seating&gt;</title>");
    expect(html).toContain("Table &lt;1&gt;");
    expect(html).toContain("Ana &quot;Bud&quot; &amp; Co");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("1 guest seated at 1 table.");
  });
});
