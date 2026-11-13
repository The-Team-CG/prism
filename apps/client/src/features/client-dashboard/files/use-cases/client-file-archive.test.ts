import { beforeEach, describe, expect, it, vi } from "vitest";
import { reuseClientStoredFile, uniqueArchivePaths } from "./client-file-archive";

const actions = vi.hoisted(() => ({ downloadClientStoredFile: vi.fn(), uploadClientStoredFile: vi.fn() }));
vi.mock("./client-stored-file-actions", () => actions);

beforeEach(() => vi.clearAllMocks());

describe("client file archive", () => {
  it("keeps every file in the ZIP when names repeat, and never writes a path separator from a file name", () => {
    expect(uniqueArchivePaths([
      { objectId: "1", name: "permit.pdf", folder: "Other" },
      { objectId: "2", name: "Permit.pdf", folder: "Other" },
      { objectId: "3", name: "permit.pdf", folder: "Contracts" },
      { objectId: "4", name: "a/b:c.pdf", folder: "Other" },
      { objectId: "5", name: "README", folder: "Other" },
      { objectId: "6", name: "README", folder: "Other" },
    ])).toEqual(["Other/permit.pdf", "Other/Permit (2).pdf", "Contracts/permit.pdf", "Other/a-b-c.pdf", "Other/README", "Other/README (2)"]);
  });

  it("reuses a file by storing a copy for this event and requirement, keeping its name and type", async () => {
    actions.downloadClientStoredFile.mockResolvedValue({ blob: new Blob(["%PDF"]), fileName: "permit.pdf", contentType: "application/pdf" });
    actions.uploadClientStoredFile.mockResolvedValue({ id: "copy" });

    await reuseClientStoredFile("source-object", "event-new", "attempt-1", "venue_permit");

    expect(actions.downloadClientStoredFile).toHaveBeenCalledWith("source-object");
    const [file, eventId, attemptId, requirementKey] = actions.uploadClientStoredFile.mock.calls[0];
    expect([file.name, file.type, eventId, attemptId, requirementKey]).toEqual(["permit.pdf", "application/pdf", "event-new", "attempt-1", "venue_permit"]);
  });
});
