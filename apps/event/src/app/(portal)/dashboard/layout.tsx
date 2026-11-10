import type { ReactNode } from "react";
import { SpotifyMusic } from "@prism/ui/spotify-music";
import { EventPortalQueryProvider } from "@/features/event-dashboard/shell/views/event-portal-query-provider";

export default function EventDashboardLayout({ children }: { children: ReactNode }) {
  return <EventPortalQueryProvider><SpotifyMusic playlistUrl={process.env.NEXT_PUBLIC_SPOTIFY_PLAYLIST_URL}>{children}</SpotifyMusic></EventPortalQueryProvider>;
}
