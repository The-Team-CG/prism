import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  assignAward: vi.fn(),
  updateLobbyBranding: vi.fn(),
  requestLobbyLogoUpload: vi.fn(),
  confirmLobbyLogoUpload: vi.fn(),
  requestGameMediaUpload: vi.fn(),
  confirmGameMediaUpload: vi.fn(),
}));

vi.mock("../data/event-games-host-repository", () => ({
  eventGamesHostRepository: repository,
}));

import { eventGamesHostActions } from "./event-games-host-actions";

const idempotencyKey = "00000000-0000-4000-8000-000000000110";

describe("eventGamesHostActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => idempotencyKey),
      subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) },
    });
    repository.assignAward.mockResolvedValue({ id: "award-1" });
    repository.updateLobbyBranding.mockResolvedValue({
      theme: "forest", primaryColor: "#14532D", secondaryColor: "#166534", logoUrl: null,
      logoObjectId: "obj_00000000-0000-4000-8000-000000000107",
    });
    repository.requestLobbyLogoUpload.mockResolvedValue({
      objectId: "obj_00000000-0000-4000-8000-000000000107",
      uploadUrl: "https://storage.example.test/signed-upload",
      expiresAt: "2026-10-17T00:05:00.000Z",
      alreadyStored: false,
    });
    repository.confirmLobbyLogoUpload.mockResolvedValue({ objectId: "obj_00000000-0000-4000-8000-000000000107" });
    repository.requestGameMediaUpload.mockResolvedValue({
      objectId: "obj_00000000-0000-4000-8000-000000000107",
      uploadUrl: "https://storage.example.test/signed-game-upload",
      expiresAt: "2026-10-17T00:05:00.000Z",
      alreadyStored: false,
    });
    repository.confirmGameMediaUpload.mockResolvedValue({ objectId: "obj_00000000-0000-4000-8000-000000000107" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a UUIDv4 idempotency key before assigning an award", async () => {
    const input = {
      recipient: {
        type: "participant" as const,
        participationGrantId: "00000000-0000-4000-8000-000000000111",
      },
      awardKind: "points" as const,
      label: "Top score",
      points: 25,
    };

    await expect(eventGamesHostActions.assignAward("event-1", "session-1", input))
      .resolves.toEqual({ id: "award-1" });

    expect(repository.assignAward).toHaveBeenCalledWith("event-1", "session-1", {
      ...input,
      idempotencyKey,
    });
  });

  it("adds a UUIDv4 idempotency key before saving lobby theme and custom colors", async () => {
    const settings = { theme: "forest" as const, primaryColor: "#14532D", secondaryColor: "#166534", logoObjectId: null };
    await expect(eventGamesHostActions.updateLobbyBranding("event-1", settings))
      .resolves.toMatchObject({ theme: "forest", primaryColor: "#14532D" });

    expect(repository.updateLobbyBranding).toHaveBeenCalledWith("event-1", {
      ...settings,
      idempotencyKey,
    });
  });

  it("uploads a constrained logo, confirms its checksum, and attaches it to the event lobby", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const current = {
      theme: "forest" as const,
      primaryColor: "#14532D",
      secondaryColor: "#166534",
      logoUrl: null,
      logoObjectId: null,
    };
    await expect(eventGamesHostActions.uploadLobbyLogo("event-1", file, current))
      .resolves.toMatchObject({ logoObjectId: "obj_00000000-0000-4000-8000-000000000107" });

    expect(repository.requestLobbyLogoUpload).toHaveBeenCalledWith("event-1", {
      fileName: "logo.png",
      contentType: "image/png",
      declaredByteSize: 4,
      checksumSha256: "0".repeat(64),
      idempotencyKey,
    });
    expect(fetch).toHaveBeenCalledWith("https://storage.example.test/signed-upload", expect.objectContaining({
      method: "PUT",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      body: file,
    }));
    expect(repository.confirmLobbyLogoUpload).toHaveBeenCalledWith("event-1", "obj_00000000-0000-4000-8000-000000000107", {
      checksumSha256: "0".repeat(64),
      byteSize: 4,
    });
    expect(repository.updateLobbyBranding).toHaveBeenCalledWith("event-1", {
      theme: "forest",
      primaryColor: "#14532D",
      secondaryColor: "#166534",
      logoObjectId: "obj_00000000-0000-4000-8000-000000000107",
      idempotencyKey,
    });
  });

  it("uploads an event game image through the game-scoped route and confirms its checksum", async () => {
    const file = new File(["image"], "clue.png", { type: "image/png" });

    await expect(eventGamesHostActions.uploadGameMedia("event-1", "game-1", file))
      .resolves.toEqual({ objectId: "obj_00000000-0000-4000-8000-000000000107" });

    expect(repository.requestGameMediaUpload).toHaveBeenCalledWith("event-1", "game-1", {
      fileName: "clue.png", contentType: "image/png", declaredByteSize: 5,
      checksumSha256: "0".repeat(64), idempotencyKey,
    });
    expect(fetch).toHaveBeenCalledWith("https://storage.example.test/signed-game-upload", expect.objectContaining({
      method: "PUT", credentials: "omit", referrerPolicy: "no-referrer", body: file,
    }));
    expect(repository.confirmGameMediaUpload).toHaveBeenCalledWith("event-1", "game-1", "obj_00000000-0000-4000-8000-000000000107", {
      checksumSha256: "0".repeat(64), byteSize: 5,
    });
  });

  it("rejects unsupported game image types or files above the storage limit", async () => {
    const invalidType = new File(["svg"], "clue.svg", { type: "image/svg+xml" });
    await expect(eventGamesHostActions.uploadGameMedia("event-1", "game-1", invalidType))
      .rejects.toThrow(/png or jpeg/i);
    expect(repository.requestGameMediaUpload).not.toHaveBeenCalled();
  });
});
