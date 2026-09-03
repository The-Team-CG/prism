import { describe, expect, it } from "vitest";
import {
  STORAGE_GATE_COPY,
  fileRequirementCounts,
  sortFileRequirementItems,
} from "./file-requirements-matrix-rules";
import type { PrismFileRequirementItem } from "@prism/types";

describe("file-requirements-matrix-rules", () => {
  it("keeps storage gated in the matrix copy", () => {
    expect(STORAGE_GATE_COPY).toMatch(/metadata-only/i);
    expect(STORAGE_GATE_COPY).toMatch(/gated/i);
  });

  it("sorts missing requirements first and counts open items", () => {
    const items = [
      { key: "b", label: "Briefing", status: "submitted" },
      { key: "a", label: "Conforme", status: "missing" },
    ] as PrismFileRequirementItem[];
    expect(sortFileRequirementItems(items).map((item) => item.key)).toEqual(["a", "b"]);
    expect(fileRequirementCounts({ eventId: "evt_1", items })).toEqual({ total: 2, open: 1 });
  });
});
