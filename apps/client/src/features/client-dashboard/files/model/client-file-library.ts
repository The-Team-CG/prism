import type { PrismDocument, PrismFileRequirementItem, PrismStoredObject, PrismSupplierRequirementVersion } from "@prism/types";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import type { ClientRowTone } from "../../shared/client-list-ui";

export type ClientFileCategory = Exclude<Extract<ClientPortalView, `files-${string}`>, "files-all"> | "other";
export type ClientFileFilter = ClientFileCategory | "all";

/** The fixed shelves of an event's library. Document types are free text from the API, so each shelf matches the words its records use. */
export const CLIENT_FILE_CATEGORIES: ReadonlyArray<{ id: Exclude<ClientFileCategory, "other">; label: string; pattern: RegExp }> = [
  { id: "files-contracts", label: "Contracts", pattern: /contract|conforme|moa|nda|agreement/i },
  { id: "files-quotations", label: "Quotes", pattern: /quot|proposal|estimate/i },
  { id: "files-invoices-receipts", label: "Billing", pattern: /invoice|receipt|billing|statement|payment/i },
  { id: "files-event-layouts", label: "Layouts", pattern: /layout|floor/i },
];

export function clientFileCategory(text: string): ClientFileCategory {
  return CLIENT_FILE_CATEGORIES.find((category) => category.pattern.test(text))?.id ?? "other";
}

/** A named file route (Contracts, Quotations, …) opens the library on that shelf. */
export function clientFileFilterForView(view: ClientPortalView | undefined): ClientFileFilter {
  return CLIENT_FILE_CATEGORIES.some((category) => category.id === view) ? (view as ClientFileFilter) : "all";
}

export type ClientFileKind = "pdf" | "image" | "sheet" | "document" | "video" | "other";

/** What a file is, from its stored type or, failing that, its extension. */
export function clientFileKind(name: string, contentType = ""): ClientFileKind {
  const type = contentType.toLowerCase();
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (type === "application/pdf" || extension === "pdf") return "pdf";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image";
  if (type.startsWith("video/") || ["mp4", "mov"].includes(extension)) return "video";
  if (/spreadsheet|excel|csv/.test(type) || ["xlsx", "xls", "csv"].includes(extension)) return "sheet";
  if (/word|document|text/.test(type) || ["docx", "doc", "txt", "pptx"].includes(extension)) return "document";
  return "other";
}

/** "118 KB", "4.2 MB". */
export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ClientLibraryFile = {
  id: string;
  name: string;
  kind: ClientFileKind;
  contentType?: string;
  size: number | null;
  category: ClientFileCategory;
  addedBy: string;
  addedAt: string | null;
  status: string;
  tone: ClientRowTone;
  /** The stored file to download; PMCM-issued records without one open their event instead. */
  objectId?: string;
  /** The requirement this file was sent for, when it fulfils one. */
  requirementLabel?: string;
  requirementKey?: string;
  /** The client can send a replacement for this file's requirement. */
  replaceable?: boolean;
  /** PMCM's reason when it did not accept this file. */
  reviewReason?: string;
  /** Every upload for the same requirement, newest first. */
  versions?: PrismSupplierRequirementVersion[];
  /** Set on results that span events (account-wide search). */
  eventId?: string;
  eventName?: string;
  /** Added by someone else since the client last opened this event's files. */
  isNew?: boolean;
};

function uploaderLabel(role: string) {
  if (role === "client") return "You";
  if (role === "supplier") return "Supplier";
  return "PMCM";
}

function storedFileStatus(object: PrismStoredObject, requirement: PrismFileRequirementItem | undefined): Pick<ClientLibraryFile, "status" | "tone"> {
  if (object.lifecycleState === "failed") return { status: "Upload failed", tone: "urgent" };
  if (object.lifecycleState === "requested") return { status: "Uploading", tone: "neutral" };
  if (!requirement) return { status: object.usage === "event_deliverable" ? "Shared with you" : "Available", tone: "neutral" };
  if (requirement.validationStatus === "rejected") return { status: "Not accepted", tone: "urgent" };
  if (requirement.status === "approved" || requirement.status === "complete") return { status: "Approved", tone: "done" };
  return { status: "In review", tone: "attention" };
}

function documentTone(status: string): ClientRowTone {
  if (/reject|needs_update/i.test(status)) return "attention";
  if (/approved|confirmed|verified/i.test(status)) return "done";
  return "neutral";
}

/**
 * Every file the client can see for one event, as one list: stored uploads (theirs and PMCM's) and PMCM-issued
 * records. A record that names the same file as an upload is shown once, as the downloadable upload.
 */
export function buildClientFileLibrary(objects: PrismStoredObject[], documents: PrismDocument[], requirements: PrismFileRequirementItem[]): ClientLibraryFile[] {
  const requirementByObject = new Map(requirements.filter((item) => item.uploadedObjectId).map((item) => [item.uploadedObjectId!, item]));
  const stored = objects
    .filter((object) => object.lifecycleState !== "deleted")
    .map((object): ClientLibraryFile => {
      const requirement = requirementByObject.get(object.id);
      const kind = object.usage === "signed_conforme" ? "conforme" : "";
      return {
        id: object.id,
        name: object.originalFileName,
        kind: clientFileKind(object.originalFileName, object.contentType),
        contentType: object.contentType,
        size: object.declaredByteSize || null,
        category: clientFileCategory(`${object.originalFileName} ${requirement?.label ?? ""} ${kind}`),
        addedBy: uploaderLabel(object.uploaderActorRole),
        addedAt: object.storedAt ?? object.createdAt,
        ...storedFileStatus(object, requirement),
        objectId: object.lifecycleState === "stored" ? object.id : undefined,
        requirementLabel: requirement?.label,
        requirementKey: requirement?.key,
        replaceable: requirement ? requirement.origin === "custom" && requirement.ownerRole === "client" && requirement.status !== "approved" : undefined,
        reviewReason: requirement?.validationStatus === "rejected" ? requirement.reviewReason : undefined,
        versions: requirement?.versions,
      };
    });
  const storedNames = new Set(stored.map((file) => file.name.toLowerCase()));
  const records = documents
    .filter((document) => !storedNames.has(document.fileName.toLowerCase()))
    .map((document): ClientLibraryFile => ({
      id: document.id,
      name: document.fileName,
      kind: clientFileKind(document.fileName),
      size: null,
      category: clientFileCategory(`${document.type} ${document.fileName}`),
      addedBy: "PMCM",
      addedAt: document.uploadedAt || null,
      status: formatStatusLabel(document.status),
      tone: documentTone(document.status),
    }));
  return [...stored, ...records].sort((left, right) => String(right.addedAt ?? "").localeCompare(String(left.addedAt ?? "")));
}

export function countClientFiles(files: ClientLibraryFile[]): Record<ClientFileFilter, number> {
  const counts = { all: files.length, other: 0 } as Record<ClientFileFilter, number>;
  for (const category of CLIENT_FILE_CATEGORIES) counts[category.id] = 0;
  for (const file of files) counts[file.category] += 1;
  return counts;
}

export function filterClientLibrary(files: ClientLibraryFile[], filter: ClientFileFilter, query: string): ClientLibraryFile[] {
  const needle = query.trim().toLowerCase();
  return files.filter((file) => (filter === "all" || file.category === filter) && (!needle || `${file.name} ${file.requirementLabel ?? ""}`.toLowerCase().includes(needle)));
}

export type ClientFileSort = { key: "date" | "name"; direction: "asc" | "desc" };

export function sortClientLibrary(files: ClientLibraryFile[], sort: ClientFileSort): ClientLibraryFile[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...files].sort((left, right) =>
    sort.key === "name"
      ? sign * left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })
      : sign * String(left.addedAt ?? "").localeCompare(String(right.addedAt ?? "")));
}

/** Someone else added this file after the client's previous visit; nothing is new on a first visit. */
export function isNewClientFile(file: Pick<ClientLibraryFile, "addedBy" | "addedAt">, lastSeen: string | null) {
  if (!lastSeen || !file.addedAt || file.addedBy === "You") return false;
  return new Date(file.addedAt).getTime() > new Date(lastSeen).getTime();
}

export type ClientEventFileSources = { eventId: string; eventName: string; objects: PrismStoredObject[]; documents: PrismDocument[] };

/** Files matching a search across all of the client's events, newest first, each naming its event. */
export function searchClientAccountFiles(events: ClientEventFileSources[], query: string): ClientLibraryFile[] {
  if (!query.trim()) return [];
  const matches = events.flatMap((event) =>
    filterClientLibrary(buildClientFileLibrary(event.objects, event.documents, []), "all", query)
      .map((file) => ({ ...file, eventId: event.eventId, eventName: event.eventName })));
  return sortClientLibrary(matches, { key: "date", direction: "desc" });
}

/** The downloadable files of a list, filed in the archive under their shelf's name. */
export function clientArchiveEntries(files: ClientLibraryFile[]) {
  const label = (category: ClientFileCategory) => CLIENT_FILE_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Other";
  return files.flatMap((file) => (file.objectId ? [{ objectId: file.objectId, name: file.name, folder: label(file.category) }] : []));
}
