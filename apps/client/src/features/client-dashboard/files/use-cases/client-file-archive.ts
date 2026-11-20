import { clientStoredFilesRepository } from "../data/client-stored-files-repository";
import { downloadClientStoredFile } from "./client-stored-file-actions";

export type ClientArchiveEntry = { objectId: string; name: string; folder: string };

/** Names inside a ZIP must be unique; a repeated name in the same folder gets " (2)", " (3)" before its extension. */
export function uniqueArchivePaths(entries: ClientArchiveEntry[]): string[] {
  // Every path handed out is remembered, so a renamed copy never lands on a file that already has that name.
  const taken = new Set<string>();
  return entries.map(({ name, folder }) => {
    const safe = name.replace(/[\\/:*?"<>|]/g, "-");
    const dot = safe.lastIndexOf(".");
    const candidate = (count: number) => count === 1 ? `${folder}/${safe}`
      : dot > 0 ? `${folder}/${safe.slice(0, dot)} (${count})${safe.slice(dot)}` : `${folder}/${safe} (${count})`;
    let count = 1;
    while (taken.has(candidate(count).toLowerCase())) count += 1;
    const path = candidate(count);
    taken.add(path.toLowerCase());
    return path;
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
