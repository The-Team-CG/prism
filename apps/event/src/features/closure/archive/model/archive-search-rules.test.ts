import { describe, expect, it } from "vitest";
import { archiveSearchEmptyCopy } from "./archive-search-rules";

describe("archive-search-rules", () => {
  it("explains an empty filtered archive", () => {
    expect(archiveSearchEmptyCopy({ venue: "Shangri" }, [])).toMatch(/No archived events match/);
    expect(archiveSearchEmptyCopy({}, [])).toMatch(/after close/);
    expect(archiveSearchEmptyCopy({}, [{ id: "1" } as never])).toBeNull();
  });
});
