"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismStoredObject } from "@prism/types";
import { moodboardRepository } from "../data/moodboard-repository";

function MoodboardThumbnail({ object }: { object: PrismStoredObject }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    void moodboardRepository.download(object.id).then((download) => { objectUrl = URL.createObjectURL(download.blob); setUrl(objectUrl); }).catch(() => setUrl(null));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [object.id]);
  // eslint-disable-next-line @next/next/no-img-element -- authorized blob URL from storage, not a static asset
  return url ? <img src={url} alt={object.originalFileName} className="h-24 w-24 rounded-md object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-md bg-muted text-3xs text-muted-foreground">{object.originalFileName}</div>;
}

/** FR-09 / FR-30: PMCM attaches moodboard images to the styling option the client reviews. */
export function MoodboardUploader({ eventId, itemId }: { eventId: string; itemId: string }) {
  const [images, setImages] = useState<PrismStoredObject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setImages(await moodboardRepository.list(eventId, itemId)); } catch { setImages([]); }
  }, [eventId, itemId]);
  useEffect(() => { void load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await moodboardRepository.upload(file, eventId, itemId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload the moodboard image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold">Moodboard ({images.length})</p>
      <div className="flex flex-wrap gap-2">{images.map((image) => <MoodboardThumbnail key={image.id} object={image} />)}</div>
      <label className="block text-xs">Add images (PNG or JPEG)
        <input type="file" multiple accept="image/png,image/jpeg" disabled={busy} onChange={(event) => void upload(event.currentTarget.files)} className="mt-1 block text-xs" />
      </label>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
