import { z } from "zod";

export const spotifyPlaylistUrlSchema = z.string().trim().regex(
  /^https:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]{22}(?:\?[^#]*)?(?:#.*)?$/,
  "Enter a Spotify playlist URL.",
);

export function spotifyPlaylistLinks(value: string | undefined): { playlist: string; embed: string } | undefined {
  const result = spotifyPlaylistUrlSchema.safeParse(value);
  if (!result.success) return undefined;
  const id = new URL(result.data).pathname.split("/")[2];
  return { playlist: `https://open.spotify.com/playlist/${id}`, embed: `https://open.spotify.com/embed/playlist/${id}` };
}
