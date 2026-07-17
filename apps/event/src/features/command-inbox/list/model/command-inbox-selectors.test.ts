import { describe, expect, it } from "vitest";
import type { PrismCommandInboxItem } from "@prism/types";
import {
  selectCommandInboxCount,
  selectCommandInboxGroupedBySeverity,
  selectCommandInboxItemsBySeverity,
  selectCriticalCommandInboxCount,
} from "./command-inbox-selectors";

function item(
  partial: Partial<PrismCommandInboxItem> & Pick<PrismCommandInboxItem, "id" | "severity">,
): PrismCommandInboxItem {
  return {
    label: partial.label ?? partial.id,
    description: partial.description ?? "",
    kind: partial.kind ?? "inquiry",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    dueAt: partial.dueAt,
    eventName: partial.eventName,
    href: partial.href,
    ...partial,
  } as PrismCommandInboxItem;
}

describe("command-inbox-selectors", () => {
  const items = [
    item({ id: "i1", severity: "info", createdAt: "2026-01-01T00:00:00.000Z" }),
    item({ id: "c1", severity: "critical", createdAt: "2026-01-02T00:00:00.000Z" }),
    item({ id: "w1", severity: "warning", dueAt: "2026-01-03T00:00:00.000Z" }),
    item({ id: "a1", severity: "attention", createdAt: "2026-01-04T00:00:00.000Z" }),
    item({ id: "c2", severity: "critical", createdAt: "2026-01-05T00:00:00.000Z" }),
  ];

  it("sorts by severity then recency", () => {
    const sorted = selectCommandInboxItemsBySeverity(items);
    expect(sorted.map((entry) => entry.id)).toEqual(["c2", "c1", "w1", "a1", "i1"]);
  });

  it("filters by severity", () => {
    const critical = selectCommandInboxItemsBySeverity(items, "critical");
    expect(critical.map((entry) => entry.id)).toEqual(["c2", "c1"]);
  });

  it("groups by severity order", () => {
    const groups = selectCommandInboxGroupedBySeverity(items);
    expect(groups.map((group) => group.severity)).toEqual([
      "critical",
      "warning",
      "attention",
      "info",
    ]);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("counts total and critical items", () => {
    expect(selectCommandInboxCount(items)).toBe(5);
    expect(selectCriticalCommandInboxCount(items)).toBe(2);
  });
});
