import { describe, expect, it } from "vitest";
import {
  buildFileRequirementCreate,
  buildFileRequirementUpdate,
  dueDateToIso,
  draftFromFileRequirementItem,
  fileRequirementCounts,
  sortFileRequirementItems,
} from "./file-requirements-matrix-rules";
import type { PrismFileRequirementItem } from "@prism/types";

const derived = {
  key: "signed_conforme",
  label: "Signed conforme",
  ownerRole: "pmcm-admin",
  visibleToRoles: ["pmcm-admin", "client"],
  sourceWorkflow: "client_onboarding",
  status: "missing",
  required: true,
  overdue: false,
  origin: "derived",
  revision: 2,
  auditCategory: "documents",
  detail: "Not uploaded.",
} as PrismFileRequirementItem;

describe("file-requirements-matrix-rules", () => {
  it("sorts overdue and missing requirements first and counts open and overdue items", () => {
    const items = [
      { key: "b", label: "Briefing", status: "submitted", overdue: false },
      { key: "a", label: "Conforme", status: "missing", overdue: false },
      { key: "c", label: "Venue permit", status: "pending", overdue: true },
    ] as PrismFileRequirementItem[];
    expect(sortFileRequirementItems(items).map((item) => item.key)).toEqual(["c", "a", "b"]);
    expect(fileRequirementCounts({ eventId: "evt_1", items })).toEqual({ total: 3, open: 2, overdue: 1 });
  });

  it("sends only changed fields with the revision the edit was based on", () => {
    const draft = { ...draftFromFileRequirementItem(derived), required: false, visibleToRoles: ["pmcm-admin", "client", "coordinator"] };
    expect(buildFileRequirementUpdate(derived, draft)).toEqual({
      required: false,
      visibleToRoles: ["pmcm-admin", "client", "coordinator"],
      expectedRevision: 2,
    });
  });

  it("returns no update when the draft still matches the item, ignoring role order and derived labels", () => {
    const draft = { ...draftFromFileRequirementItem(derived), label: "Renamed label", visibleToRoles: ["client", "pmcm-admin"] };
    expect(buildFileRequirementUpdate(derived, draft)).toBeNull();
  });

  it("clears a due date as null and only sends a label change for custom requirements", () => {
    const withDue = { ...derived, dueDate: "2026-10-25T23:59:59.000Z" } as PrismFileRequirementItem;
    expect(buildFileRequirementUpdate(withDue, { ...draftFromFileRequirementItem(withDue), dueDate: "" })).toEqual({ dueAt: null, expectedRevision: 2 });

    const custom = { ...derived, key: "venue_permit", origin: "custom", label: "Venue permit" } as PrismFileRequirementItem;
    expect(buildFileRequirementUpdate(custom, { ...draftFromFileRequirementItem(custom), label: " Venue licence " })).toEqual({ label: "Venue licence", expectedRevision: 2 });
  });

  it("builds a custom create input whose due date is the end of the chosen day", () => {
    const input = buildFileRequirementCreate({
      key: " venue_permit ", label: "Venue permit", ownerRole: "client", visibleToRoles: ["client", "pmcm-admin"], required: true, dueDate: "2026-10-25", notes: "  ",
    });
    expect(input).toMatchObject({ key: "venue_permit", label: "Venue permit", sourceWorkflow: "custom", required: true, notes: undefined });
    expect(input.dueAt).toBe(dueDateToIso("2026-10-25"));
    expect(new Date(input.dueAt as string).getDate()).toBe(new Date("2026-10-25T12:00:00").getDate());
  });
});
