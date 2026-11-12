"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Music2 } from "lucide-react";
import { spotifyPlaylistLinks } from "@prism/types";
import { Button } from "./components/ui/button";

const MusicContext = createContext<{ open: boolean; toggle: () => void } | null>(null);

export function SpotifyMusicControl() {
  const music = useContext(MusicContext);
  if (!music) return null;
  return (
    <Button type="button" variant="ghost" size="sm" aria-label={music.open ? "Stop and close" : "Music"} aria-expanded={music.open} aria-controls={music.open ? "spotify-playlist" : undefined} onClick={music.toggle}>
      <Music2 aria-hidden="true" /><span className="hidden sm:inline">{music.open ? "Stop and close" : "Music"}</span>
    </Button>
  );
}

export function SpotifyMusic({ playlistUrl, children }: { playlistUrl?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = spotifyPlaylistLinks(playlistUrl);
  if (!links) return children;

  return (
    <MusicContext.Provider value={{ open, toggle: () => setOpen((value) => !value) }}>
    <div className={open ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]" : undefined}>
      {open ? (
        <aside aria-label="Music" id="spotify-playlist" className="order-2 border-b border-border bg-card p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-l">
          <h2 className="text-base font-semibold">Music</h2>
          <div className="mt-3 flex flex-col gap-3">
            <iframe title="Spotify playlist" src={links.embed} width="100%" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-md border-0" />
            <a href={links.playlist} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Open in Spotify <span className="sr-only">(opens in a new tab)</span></a>
          </div>
        </aside>
      ) : null}
      <div className="min-w-0 lg:order-1">{children}</div>
    </div>
    </MusicContext.Provider>
  );
}
