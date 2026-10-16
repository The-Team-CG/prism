import { describe, expect, it } from "vitest";
import {
  fileRequirementCounts,
  sortFileRequirementItems,
} from "./file-requirements-matrix-rules";
import type { PrismFileRequirementItem } from "@prism/types";

describe("file-requirements-matrix-rules", () => {
  it("sorts missing requirements first and counts open items", () => {
    const items = [
      { key: "b", label: "Briefing", status: "submitted" },
      { key: "a", label: "Conforme", status: "missing" },
    ] as PrismFileRequirementItem[];
    expect(sortFileRequirementItems(items).map((item) => item.key)).toEqual(["a", "b"]);
    expect(fileRequirementCounts({ eventId: "evt_1", items })).toEqual({ total: 2, open: 1 });
  });
});
