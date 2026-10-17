import { describe, expect, it } from "vitest";
import { resolveGuestGameLobbyUrl } from "./guest-lobby-url";

describe("resolveGuestGameLobbyUrl", () => {
  it("uses the configured guest portal origin", () => {
    expect(resolveGuestGameLobbyUrl(
      "opaque/lobby",
      "https://games.example.test",
      "https://event.example.test",
    )).toBe("https://games.example.test/games/events/opaque%2Flobby");
  });

  it("preserves a same-origin guest base path in services mode", () => {
    expect(resolveGuestGameLobbyUrl(
      "opaque-lobby",
      "/guest",
      "https://prism.example.test",
    )).toBe("https://prism.example.test/guest/games/events/opaque-lobby");
  });
});
