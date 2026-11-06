import { describe, expect, it } from "vitest";
import { orderPickerEvents } from "./event-destination-picker";

const event = (id: string, eventDate: string, overrides: Record<string, unknown> = {}) => ({
  id,
  eventName: id,
  clientName: "Client",
  eventDate,
  status: "planning",
  archived: false,
  actualEndedAt: null,
  clientPortalStatus: "unlocked" as const,
  proposalClientStatus: "approved" as const,
  ...overrides,
});

describe("orderPickerEvents", () => {
  it("lists events still being run soonest first, then finished events most recent first", () => {
    const ordered = orderPickerEvents([
      event("closed-old", "2026-08-25", { archived: true }),
      event("later", "2026-12-01"),
      event("closed-recent", "2026-10-30", { status: "completed" }),
      event("sooner", "2026-11-03"),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["sooner", "later", "closed-recent", "closed-old"]);
  });
});
