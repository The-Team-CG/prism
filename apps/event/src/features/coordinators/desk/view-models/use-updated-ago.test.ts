import { describe, expect, it } from "vitest";
import { updatedAgoLabel } from "./use-updated-ago";

describe("updatedAgoLabel", () => {
  it("says just now, then tens of seconds, then minutes", () => {
    expect(updatedAgoLabel(4)).toBe("Updated just now");
    expect(updatedAgoLabel(27)).toBe("Updated 20 s ago");
    expect(updatedAgoLabel(185)).toBe("Updated 3 min ago");
  });
});
