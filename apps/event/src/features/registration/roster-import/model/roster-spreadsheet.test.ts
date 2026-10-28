import { describe, expect, it } from "vitest";
import { importGuestRosterSchema } from "@prism/types";
import { buildRosterImportPayload, buildRosterTemplateCsv, previewRosterSpreadsheet, rosterSourceError } from "./roster-spreadsheet";

describe("roster spreadsheet import", () => {
  it("reads the downloadable template into the shared import payload", () => {
    const preview = previewRosterSpreadsheet(buildRosterTemplateCsv());
    expect(preview).toMatchObject({ headerErrors: [], validCount: 2, errorCount: 0 });
    const payload = buildRosterImportPayload("spreadsheet", preview);
    expect(importGuestRosterSchema.safeParse(payload).success).toBe(true);
    expect(payload?.rows[0]).toEqual({ guestName: "Ada Lovelace", category: "VIP", table: "T1", sourceKey: "A-001", email: "ada@example.com", eligibility: "eligible" });
  });

  it("accepts tab-separated paste with spreadsheet-style headers and quoted commas", () => {
    const tsv = "Guest name\tCategory\tTable\tGuest ID\tNotes\n\"Reyes, Ana\"\tVIP\tT1\tA-1\tignored\n";
    const preview = previewRosterSpreadsheet(tsv);
    expect(preview.ignoredHeaders).toEqual(["Notes"]);
    expect(preview.rows[0]?.values).toMatchObject({ guestName: "Reyes, Ana", sourceKey: "A-1" });

    const csv = 'guestName,sourceKey\n"Reyes, Ana",A-1\n';
    expect(previewRosterSpreadsheet(csv).rows[0]?.values.guestName).toBe("Reyes, Ana");
  });

  it("flags invalid rows with line numbers and blocks a partial import", () => {
    const preview = previewRosterSpreadsheet([
      "guestName,category,table,sourceKey,eligibility",
      "Ada Lovelace,VIP,T1,A-1,eligible",
      ",VIP,T2,A-2,",
      "Grace Hopper,,,A-1,",
      "Alan Turing,,,A-4,maybe",
    ].join("\n"));
    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(3);
    expect(preview.rows.map((row) => [row.line, row.errors])).toEqual([
      [2, []],
      [3, ["Guest name is required"]],
      [4, ["Guest ID A-1 repeats line 2"]],
      [5, ["Eligibility must be eligible or ineligible"]],
    ]);
    expect(buildRosterImportPayload("spreadsheet", preview)).toBeNull();
  });

  it("explains a missing required column instead of guessing", () => {
    const preview = previewRosterSpreadsheet("name,table\nAda,T1\n");
    expect(preview.headerErrors[0]).toContain("sourceKey");
    expect(preview.rows).toHaveLength(0);
  });

  it("rejects an empty or reserved source", () => {
    expect(rosterSourceError(" ")).toMatch(/Name the source/);
    expect(rosterSourceError("Coordinator-Walk-In")).toMatch(/reserved/);
    expect(rosterSourceError("xperto")).toBeNull();
  });
});
