"use client";

import { useEffect, useState } from "react";
import type { PrismStoredObject } from "@prism/types";
import { moodboardRepository } from "../data/moodboard-repository";

function MoodboardImage({ object }: { object: PrismStoredObject }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    void moodboardRepository.download(object.id).then((download) => { objectUrl = URL.createObjectURL(download.blob); setUrl(objectUrl); }).catch(() => setUrl(null));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [object.id]);
  if (!url) return <div className="grid aspect-square place-items-center rounded-lg bg-muted text-xs text-muted-foreground">{object.originalFileName}</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- authorized blob URL from storage, not a static asset */}
      <img src={url} alt={object.originalFileName} className="aspect-square w-full rounded-lg object-cover" />
    </a>
  );
}

/** FR-30: the client views the moodboard of a styling option before approving it or asking for changes. */
export function StylingMoodboard({ eventId, itemId }: { eventId: string; itemId: string }) {
  const [images, setImages] = useState<PrismStoredObject[]>([]);
  useEffect(() => {
    void moodboardRepository.list(eventId, itemId).then(setImages).catch(() => setImages([]));
  }, [eventId, itemId]);
  if (images.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-foreground">Moodboard</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">{images.map((image) => <MoodboardImage key={image.id} object={image} />)}</div>
    </div>
  );
}
