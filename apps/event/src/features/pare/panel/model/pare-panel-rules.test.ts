import { describe, expect, it } from "vitest";
import { selectEventPareApprovals } from "./pare-panel-rules";

describe("pare-panel-rules", () => {
  it("keeps only approval records for the selected event", () => {
    expect(
      selectEventPareApprovals(
        [
          { eventId: "evt-1", id: "pare-1" },
          { eventId: "evt-2", id: "pare-2" },
        ],
        "evt-1",
      ),
    ).toEqual([{ eventId: "evt-1", id: "pare-1" }]);
  });
});
