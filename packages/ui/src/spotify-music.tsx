"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Music2 } from "lucide-react";
import { spotifyPlaylistLinks } from "@prism/types";
import { Button } from "./components/ui/button";

export function SpotifyMusic({ playlistUrl, children }: { playlistUrl?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dock = useRef<HTMLElement>(null);
  const links = spotifyPlaylistLinks(playlistUrl);
  useEffect(() => {
    if (open) dock.current?.scrollIntoView?.({ block: "start" });
  }, [open]);
  if (!links) return children;

  return (
    <div className={open ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]" : undefined}>
      <Button type="button" variant={open ? "outline" : "default"} aria-expanded={open} aria-controls={open ? "spotify-playlist" : undefined} onClick={() => setOpen(!open)} className="fixed bottom-4 right-4 z-40">
        <Music2 aria-hidden="true" />{open ? "Stop and close" : "Music"}
      </Button>
      {open ? (
        <aside ref={dock} aria-label="Music" id="spotify-playlist" className="order-2 border-b border-border bg-card p-4 pb-20 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-l">
          <h2 className="text-base font-semibold">Music</h2>
          <div className="mt-3 flex flex-col gap-3">
            <iframe title="Spotify playlist" src={links.embed} width="100%" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-md border-0" />
            <a href={links.playlist} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Open in Spotify <span className="sr-only">(opens in a new tab)</span></a>
          </div>
        </aside>
      ) : null}
      <div className="min-w-0 lg:order-1">{children}</div>
    </div>
  );
}
