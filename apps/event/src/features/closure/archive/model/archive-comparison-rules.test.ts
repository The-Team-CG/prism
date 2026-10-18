import { describe, expect, it } from "vitest";
import { ARCHIVE_COMPARISON_MAX_EVENTS, canCompareArchivedEvents, toggleArchiveComparisonSelection } from "./archive-comparison-rules";

describe("archive-comparison-rules", () => {
  it("keeps the selection between two and four distinct archived events", () => {
    let selected: string[] = [];
    selected = toggleArchiveComparisonSelection(selected, "a");
    expect(canCompareArchivedEvents(selected)).toBe(false);
    selected = toggleArchiveComparisonSelection(selected, "b");
    expect(canCompareArchivedEvents(selected)).toBe(true);
    selected = toggleArchiveComparisonSelection(selected, "c");
    selected = toggleArchiveComparisonSelection(selected, "d");
    expect(selected).toHaveLength(ARCHIVE_COMPARISON_MAX_EVENTS);
    expect(toggleArchiveComparisonSelection(selected, "e")).toEqual(selected);
    expect(toggleArchiveComparisonSelection(selected, "a")).toEqual(["b", "c", "d"]);
    expect(canCompareArchivedEvents(["a", "b", "c", "d", "e"])).toBe(false);
  });
});
