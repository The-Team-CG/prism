import { storedFileExpiryDay, storedFileExpiryState } from "@prism/types";

/** What kind of file it is, for its icon and whether the browser can show it. */
export type FileKind = "pdf" | "image" | "sheet" | "document" | "video" | "other";

/** How loud a file's status is: red when it needs fixing, orange when it waits, green when done. */
export type FileTone = "urgent" | "attention" | "done" | "neutral";

const KIND_RULES: ReadonlyArray<{ kind: FileKind; type: RegExp; extensions: readonly string[] }> = [
  { kind: "pdf", type: /^application\/pdf$/, extensions: ["pdf"] },
  { kind: "image", type: /^image\//, extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
  { kind: "video", type: /^video\//, extensions: ["mp4", "mov"] },
  { kind: "sheet", type: /spreadsheet|excel|csv/, extensions: ["xlsx", "xls", "csv"] },
  { kind: "document", type: /word|document|text/, extensions: ["docx", "doc", "txt", "pptx"] },
];

/** What a file is, from its stored type or, failing that, its extension. */
export function fileKind(name: string, contentType = ""): FileKind {
  const type = contentType.toLowerCase();
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return KIND_RULES.find((rule) => rule.type.test(type) || rule.extensions.includes(extension))?.kind ?? "other";
}

/** "118 KB", "4.2 MB"; nothing for an unknown or empty size. */
export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileExpiry = { label: string; tone: FileTone; expired: boolean };

/** When a dated document (a permit, insurance, a registration) stops being valid, and how close that is. */
export function fileExpiry(expiresAt: string | null | undefined, now = new Date()): FileExpiry | null {
  if (!expiresAt) return null;
  const date = storedFileExpiryDay(expiresAt);
  const state = storedFileExpiryState(expiresAt, now);
  if (state === "expired") return { label: `Expired ${date}`, tone: "urgent", expired: true };
  if (state === "expiring") return { label: `Expires ${date}`, tone: "attention", expired: false };
  return { label: `Valid until ${date}`, tone: "neutral", expired: false };
}
