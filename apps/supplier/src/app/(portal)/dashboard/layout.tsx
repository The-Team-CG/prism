import type { ReactNode } from "react";
import { SpotifyMusic } from "@prism/ui/spotify-music";
import { SupplierPortalQueryProvider } from "@/features/supplier-dashboard/workspace/views/supplier-portal-query-provider";

export default function SupplierDashboardLayout({ children }: { children: ReactNode }) {
  return <SupplierPortalQueryProvider><SpotifyMusic playlistUrl={process.env.NEXT_PUBLIC_SPOTIFY_PLAYLIST_URL}>{children}</SpotifyMusic></SupplierPortalQueryProvider>;
}
