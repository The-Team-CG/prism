import { describe, expect, it } from "vitest";
import type { PrismClientActionItem } from "@prism/types";
import { selectEventNextAction } from "./client-event-next-action";

const item = (id: string, priority: PrismClientActionItem["priority"], dueAt: string | null, eventId = "event-a", stage: PrismClientActionItem["stage"] = "needs_client") =>
  ({ id, stage, priority, dueAt, eventId, kind: "document", label: id, description: "", status: "open", eventName: eventId }) as PrismClientActionItem;

describe("event overview next step", () => {
  it("leads with the most severe open item for this event, soonest due first", () => {
    const items = [
      item("other-event-critical", "critical", "2026-10-30", "event-b"),
      item("with-pmcm", "critical", "2026-10-20", "event-a", "with_pmcm"),
      item("later-warning", "warning", "2026-11-20"),
      item("sooner-warning", "warning", "2026-11-01"),
      item("undated-warning", "warning", null),
      item("attention", "attention", "2026-10-30"),
    ];
    expect(selectEventNextAction(items, "event-a")?.id).toBe("sooner-warning");
  });

  it("has no next step when only news and items with PMCM remain", () => {
    expect(selectEventNextAction([item("update", "attention", null, "event-a", "to_review"), item("pmcm", "info", null, "event-a", "with_pmcm")], "event-a")).toBeUndefined();
  });
});
