import { describe, expect, it } from "vitest";
import { archiveSearchEmptyCopy } from "./archive-search-rules";

describe("archive-search-rules", () => {
  it("explains an empty filtered archive", () => {
    expect(archiveSearchEmptyCopy({ venue: "Shangri" }, [])).toMatch(/No archived events match/);
    expect(archiveSearchEmptyCopy({}, [])).toMatch(/after close/);
    expect(archiveSearchEmptyCopy({}, [{ id: "1" } as never])).toBeNull();
  });
});

describe("archive list paging", () => {
  it("shows 25 hits at a time and counts the rest", async () => {
    const { ARCHIVE_PAGE_SIZE, visibleArchiveHits } = await import("./archive-search-rules");
    const hits = Array.from({ length: 60 }, (_, index) => ({ id: `evt_${index}` }) as never);
    expect(visibleArchiveHits(hits, ARCHIVE_PAGE_SIZE)).toMatchObject({ remaining: 35 });
    expect(visibleArchiveHits(hits, ARCHIVE_PAGE_SIZE).visible).toHaveLength(25);
    expect(visibleArchiveHits(hits, ARCHIVE_PAGE_SIZE * 3)).toMatchObject({ remaining: 0 });
  });
});
