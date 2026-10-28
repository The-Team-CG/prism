import { describe, expect, it } from "vitest";
import type { PrismDocument } from "@prism/types";
import { filterClientFiles } from "./client-file-category";

const doc = (id: string, type: string, fileName = `${id}.pdf`): PrismDocument =>
  ({ id, eventId: "event-a", type, fileName, status: "approved", uploadedAt: "2026-10-28T12:00:00Z" });

describe("client file routes", () => {
  const documents = [doc("permit", "venue_permit"), doc("conforme", "signed_conforme"), doc("statement", "billing_statement"), doc("plan", "other", "main-hall-layout.pdf")];

  it("shows only the records each named route is about", () => {
    const ids = (view: Parameters<typeof filterClientFiles>[1]) => filterClientFiles(documents, view).documents.map((entry) => entry.id);
    expect(ids("files-contracts")).toEqual(["conforme"]);
    expect(ids("files-invoices-receipts")).toEqual(["statement"]);
    expect(ids("files-event-layouts")).toEqual(["plan"]);
    expect(ids("files-quotations")).toEqual([]);
    expect(ids("files-all")).toHaveLength(4);
  });

  it("admits when records cannot answer a route instead of implying a filter ran", () => {
    expect(filterClientFiles(documents, "files-shared")).toEqual({ documents, filtered: false });
    expect(filterClientFiles(documents, "files-all").filtered).toBe(true);
  });
});
