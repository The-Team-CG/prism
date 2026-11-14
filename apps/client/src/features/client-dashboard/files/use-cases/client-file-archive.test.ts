import { beforeEach, describe, expect, it, vi } from "vitest";
import { reuseClientStoredFile, uniqueArchivePaths } from "./client-file-archive";

const actions = vi.hoisted(() => ({ downloadClientStoredFile: vi.fn() }));
const repository = vi.hoisted(() => ({ copy: vi.fn(), bindRequirementUpload: vi.fn() }));
vi.mock("./client-stored-file-actions", () => actions);
vi.mock("../data/client-stored-files-repository", () => ({ clientStoredFilesRepository: repository }));

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

  it("reuses a file by having the server store a copy for this event, then sends the copy for the requirement", async () => {
    repository.copy.mockResolvedValue({ id: "copy", eventId: "event-new" });

    await reuseClientStoredFile("source-object", "event-new", "attempt-1", "venue_permit");
    await reuseClientStoredFile("source-object", "event-new", "attempt-2");

    expect(repository.copy.mock.calls).toEqual([["source-object", "event-new", "attempt-1"], ["source-object", "event-new", "attempt-2"]]);
    expect(repository.bindRequirementUpload.mock.calls).toEqual([["event-new", "venue_permit", "copy"]]);
    expect(actions.downloadClientStoredFile).not.toHaveBeenCalled();
  });
});
