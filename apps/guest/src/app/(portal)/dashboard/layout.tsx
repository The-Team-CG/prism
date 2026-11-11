import type { ReactNode } from "react";
import { SpotifyMusic } from "@prism/ui/spotify-music";

export default function GuestDashboardLayout({ children }: { children: ReactNode }) {
  return <SpotifyMusic playlistUrl={process.env.NEXT_PUBLIC_SPOTIFY_PLAYLIST_URL}>{children}</SpotifyMusic>;
}
