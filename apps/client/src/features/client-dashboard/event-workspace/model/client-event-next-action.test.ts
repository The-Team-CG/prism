import { describe, expect, it } from "vitest";
import type { PrismClientActionItem } from "@prism/types";
import { selectEventNextAction } from "./client-event-next-action";

const item = (id: string, priority: PrismClientActionItem["priority"], dueAt: string | null, eventId = "event-a") =>
  ({ id, priority, dueAt, eventId, kind: "document", label: id, description: "", status: "open", eventName: eventId }) as PrismClientActionItem;

describe("event overview next step", () => {
  it("leads with the most severe open item for this event, soonest due first", () => {
    const items = [
      item("other-event-critical", "critical", "2026-10-30", "event-b"),
      item("update", "info", "2026-10-29"),
      item("later-warning", "warning", "2026-11-20"),
      item("sooner-warning", "warning", "2026-11-01"),
      item("undated-warning", "warning", null),
      item("attention", "attention", "2026-10-30"),
    ];
    expect(selectEventNextAction(items, "event-a")?.id).toBe("sooner-warning");
  });

  it("has no next step when only informational updates remain", () => {
    expect(selectEventNextAction([item("update", "info", null)], "event-a")).toBeUndefined();
  });
});
