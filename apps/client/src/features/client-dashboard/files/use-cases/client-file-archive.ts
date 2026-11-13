import { clientStoredFilesRepository } from "../data/client-stored-files-repository";
import { downloadClientStoredFile } from "./client-stored-file-actions";

export type ClientArchiveEntry = { objectId: string; name: string; folder: string };

/** Names inside a ZIP must be unique; a repeated name in the same folder gets " (2)", " (3)" before its extension. */
export function uniqueArchivePaths(entries: ClientArchiveEntry[]): string[] {
  const used = new Map<string, number>();
  return entries.map(({ name, folder }) => {
    const safe = name.replace(/[\\/:*?"<>|]/g, "-");
    const base = `${folder}/${safe}`.toLowerCase();
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    if (count === 1) return `${folder}/${safe}`;
    const dot = safe.lastIndexOf(".");
    return dot > 0 ? `${folder}/${safe.slice(0, dot)} (${count})${safe.slice(dot)}` : `${folder}/${safe} (${count})`;
  });
}

/**
 * Downloads every listed file and packs them into one ZIP, a folder per shelf. Files that fail are skipped
 * and named in the result so the client knows the archive is incomplete.
 */
export async function buildClientEventArchive(entries: ClientArchiveEntry[], onProgress: (done: number, total: number) => void) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const paths = uniqueArchivePaths(entries);
  const failed: string[] = [];
  for (const [index, entry] of entries.entries()) {
    onProgress(index, entries.length);
    try {
      const file = await downloadClientStoredFile(entry.objectId);
      zip.file(paths[index], file.blob);
    } catch {
      failed.push(entry.name);
    }
  }
  onProgress(entries.length, entries.length);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, failed };
}

/**
 * Reuses a file from another of the client's events: the server stores a copy for this event (each event keeps its
 * own record and retention), then the copy is sent for the requirement when one is given.
 */
export async function reuseClientStoredFile(sourceObjectId: string, eventId: string, attemptId: string, requirementKey?: string) {
  const copy = await clientStoredFilesRepository.copy(sourceObjectId, eventId, attemptId);
  if (requirementKey) await clientStoredFilesRepository.bindRequirementUpload(eventId, requirementKey, copy.id);
  return copy;
}
