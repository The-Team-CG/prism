import { describe, expect, it } from "vitest";
import { spotifyPlaylistLinks } from "./portal-music.js";

describe("Spotify playlist configuration", () => {
  it("uses only the playlist ID from a valid Spotify URL", () => {
    expect(spotifyPlaylistLinks(" https://open.spotify.com/playlist/7w8goVzwvr1smmS5zMf4HI?si=example ")).toEqual({
      playlist: "https://open.spotify.com/playlist/7w8goVzwvr1smmS5zMf4HI",
      embed: "https://open.spotify.com/embed/playlist/7w8goVzwvr1smmS5zMf4HI",
    });
  });

  it.each([undefined, "", "http://open.spotify.com/playlist/7w8goVzwvr1smmS5zMf4HI", "https://open.spotify.com.evil.test/playlist/7w8goVzwvr1smmS5zMf4HI", "https://user@open.spotify.com/playlist/7w8goVzwvr1smmS5zMf4HI", "https://open.spotify.com/track/7w8goVzwvr1smmS5zMf4HI", "https://open.spotify.com/playlist/bad"])
    ("disables the player for invalid configuration %s", (value) => {
      expect(spotifyPlaylistLinks(value)).toBeUndefined();
    });
});
