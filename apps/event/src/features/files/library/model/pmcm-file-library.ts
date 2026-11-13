import { EVENT_FILE_CATEGORIES, eventFileCategoryOf, type PrismFileRequirementItem, type PrismStoredObject, type PrismSupplierRequirementVersion } from "@prism/types";

export type PmcmFileKind = "pdf" | "image" | "sheet" | "document" | "video" | "other";

const KIND_RULES: ReadonlyArray<{ kind: PmcmFileKind; type: RegExp; extensions: readonly string[] }> = [
  { kind: "pdf", type: /^application\/pdf$/, extensions: ["pdf"] },
  { kind: "image", type: /^image\//, extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
  { kind: "video", type: /^video\//, extensions: ["mp4", "mov"] },
  { kind: "sheet", type: /spreadsheet|excel|csv/, extensions: ["xlsx", "xls", "csv"] },
  { kind: "document", type: /word|document|text/, extensions: ["docx", "doc", "txt", "pptx"] },
];

/** What a file is, from its stored type or, failing that, its extension. */
export function pmcmFileKind(name: string, contentType = ""): PmcmFileKind {
  const type = contentType.toLowerCase();
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return KIND_RULES.find((rule) => rule.type.test(type) || rule.extensions.includes(extension))?.kind ?? "other";
}

/** "118 KB", "4.2 MB". */
export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Who a file came from, which is how PMCM works through an event's files. */
export type PmcmFileSource = "client" | "supplier" | "pmcm";
export type PmcmFileFilter = "all" | "review" | PmcmFileSource;
export type PmcmFileTone = "attention" | "urgent" | "done" | "neutral";

/** A file PMCM has not approved or rejected yet, and the requirement it was sent for. */
export type PmcmReviewEntry = {
  key: string;
  requirementLabel: string;
  documentId: string;
  objectId: string;
  fileName: string;
  sender: string;
  uploadedAt: string;
};

export type PmcmLibraryFile = {
  id: string;
  name: string;
  kind: PmcmFileKind;
  contentType: string;
  size: number | null;
  source: PmcmFileSource;
  from: string;
  /** The deliverable type PMCM chose, or the requirement the file was sent for. */
  label: string | null;
  addedAt: string;
  status: string;
  tone: PmcmFileTone;
  reviewReason?: string;
  /** Set while the file waits for PMCM's decision. */
  review?: PmcmReviewEntry;
  /** The last day the document is valid, when it has one. */
  expiresAt: string | null;
};

/** Warn this long before a document stops being valid. */
const EXPIRY_WARNING_DAYS = 30;

/** Whether a dated document is still valid: expired, expiring within a month, or valid until its date. */
export function pmcmFileExpiry(expiresAt: string | null | undefined, now = new Date()): { label: string; tone: PmcmFileTone } | null {
  if (!expiresAt) return null;
  const date = expiresAt.slice(0, 10);
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  if (remaining < 0) return { label: `Expired ${date}`, tone: "urgent" };
  if (remaining <= EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000) return { label: `Expires ${date}`, tone: "attention" };
  return { label: `Valid until ${date}`, tone: "neutral" };
}

type RequirementFile = { item: PrismFileRequirementItem; version: PrismSupplierRequirementVersion; sender: string };

const VERSION_STATUS: Record<string, { status: string; tone: PmcmFileTone }> = {
  submitted: { status: "Waiting for review", tone: "attention" },
  approved: { status: "Approved", tone: "done" },
  rejected: { status: "Rejected", tone: "urgent" },
  replaced: { status: "Replaced", tone: "neutral" },
};

/** Every upload sent for a requirement, keyed by its stored file, with who sent it. */
function requirementFiles(items: PrismFileRequirementItem[]): Map<string, RequirementFile> {
  const files = new Map<string, RequirementFile>();
  for (const item of items) {
    for (const fulfilment of item.supplierFulfilments ?? []) {
      for (const version of fulfilment.versions ?? []) files.set(version.objectId, { item, version, sender: fulfilment.supplierName });
    }
    if (item.supplierFulfilments) continue;
    for (const version of item.versions ?? []) files.set(version.objectId, { item, version, sender: item.ownerRole === "client" ? "Client" : "Coordinator" });
  }
  return files;
}

/** The files waiting for PMCM's decision, oldest first: each is its sender's newest upload for the requirement. */
export function pmcmReviewQueue(items: PrismFileRequirementItem[]): PmcmReviewEntry[] {
  return [...requirementFiles(items).values()]
    .filter(({ version }) => version.status === "submitted")
    .map(({ item, version, sender }) => ({
      key: item.key, requirementLabel: item.label, documentId: version.documentId, objectId: version.objectId,
      fileName: version.fileName, sender, uploadedAt: version.uploadedAt,
    }))
    .sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));
}

function sourceOf(object: PrismStoredObject): PmcmFileSource {
  if (object.uploaderActorRole === "client") return "client";
  if (object.uploaderActorRole === "supplier") return "supplier";
  return "pmcm";
}

const SOURCE_LABEL: Record<PmcmFileSource, string> = { client: "Client", supplier: "Supplier", pmcm: "PMCM" };

function fileStatus(object: PrismStoredObject, sent: RequirementFile | undefined): { status: string; tone: PmcmFileTone } {
  if (sent) return VERSION_STATUS[sent.version.status] ?? { status: sent.version.status, tone: "neutral" };
  if (object.usage === "event_deliverable") return { status: "Shared with client", tone: "neutral" };
  return { status: "Stored", tone: "neutral" };
}

/**
 * The event's stored files as one list: what PMCM shared, what the client sent and each supplier's files, with the
 * requirement each was sent for and where its review stands. Unfinished and failed uploads are kept apart.
 */
export function buildPmcmFileLibrary(objects: PrismStoredObject[], items: PrismFileRequirementItem[]) {
  const sentFiles = requirementFiles(items);
  const queue = new Map(pmcmReviewQueue(items).map((entry) => [entry.objectId, entry]));
  const files: PmcmLibraryFile[] = [];
  const unfinished: PrismStoredObject[] = [];
  for (const object of objects) {
    if (object.lifecycleState === "deleted") continue;
    if (object.lifecycleState !== "stored") { unfinished.push(object); continue; }
    const sent = sentFiles.get(object.id);
    const source = sourceOf(object);
    files.push({
      id: object.id,
      name: object.originalFileName,
      kind: pmcmFileKind(object.originalFileName, object.contentType),
      contentType: object.contentType,
      size: object.declaredByteSize || null,
      source,
      from: sent?.sender ?? SOURCE_LABEL[source],
      label: sent?.item.label ?? (object.usage === "event_deliverable" ? EVENT_FILE_CATEGORIES[eventFileCategoryOf(object.logicalTarget)] : null),
      addedAt: object.storedAt ?? object.createdAt,
      expiresAt: object.expiresAt ?? null,
      ...fileStatus(object, sent),
      ...(sent?.version.reviewReason ? { reviewReason: sent.version.reviewReason } : {}),
      ...(queue.has(object.id) ? { review: queue.get(object.id) } : {}),
    });
  }
  files.sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  return { files, unfinished };
}

export function countPmcmFiles(files: PmcmLibraryFile[]): Record<PmcmFileFilter, number> {
  return {
    all: files.length,
    review: files.filter((file) => file.review).length,
    client: files.filter((file) => file.source === "client").length,
    supplier: files.filter((file) => file.source === "supplier").length,
    pmcm: files.filter((file) => file.source === "pmcm").length,
  };
}

export function filterPmcmFiles(files: PmcmLibraryFile[], filter: PmcmFileFilter, query: string) {
  const needle = query.trim().toLowerCase();
  return files.filter((file) => {
    const inFilter = filter === "all" || (filter === "review" ? Boolean(file.review) : file.source === filter);
    return inFilter && (!needle || `${file.name} ${file.from} ${file.label ?? ""}`.toLowerCase().includes(needle));
  });
}
