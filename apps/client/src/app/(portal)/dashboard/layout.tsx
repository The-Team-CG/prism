import type { ReactNode } from "react";
import { SpotifyMusic } from "@prism/ui/spotify-music";
import { ClientPortalQueryProvider } from "@/features/client-dashboard/workspace/views/client-portal-query-provider";

export default function ClientDashboardLayout({ children }: { children: ReactNode }) {
  return <ClientPortalQueryProvider><SpotifyMusic playlistUrl={process.env.NEXT_PUBLIC_SPOTIFY_PLAYLIST_URL}>{children}</SpotifyMusic></ClientPortalQueryProvider>;
}
