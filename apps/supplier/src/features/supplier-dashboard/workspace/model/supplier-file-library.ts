import type { PrismSupplierCertification, PrismSupplierContractVersion } from "@prism/types";
import type { SupplierFileRequirementRow } from "./supplier-workspace-rules";

export type SupplierFileKind = "pdf" | "image" | "sheet" | "document" | "video" | "other";
export type SupplierFileGroup = "booking" | "contract" | "certification";
export type SupplierFileFilter = "all" | SupplierFileGroup;
export type SupplierFileTone = "attention" | "urgent" | "done" | "neutral";

const KIND_RULES: ReadonlyArray<{ kind: SupplierFileKind; type: RegExp; extensions: readonly string[] }> = [
  { kind: "pdf", type: /^application\/pdf$/, extensions: ["pdf"] },
  { kind: "image", type: /^image\//, extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
  { kind: "video", type: /^video\//, extensions: ["mp4", "mov"] },
  { kind: "sheet", type: /spreadsheet|excel|csv/, extensions: ["xlsx", "xls", "csv"] },
  { kind: "document", type: /word|document|text/, extensions: ["docx", "doc", "txt", "pptx"] },
];

/** What a file is, from its stored type or, failing that, its extension. */
export function supplierFileKind(name: string, contentType = ""): SupplierFileKind {
  const type = contentType.toLowerCase();
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return KIND_RULES.find((rule) => rule.type.test(type) || rule.extensions.includes(extension))?.kind ?? "other";
}

export type SupplierLibraryFile = {
  id: string;
  name: string;
  kind: SupplierFileKind;
  contentType?: string;
  group: SupplierFileGroup;
  /** The booking and what the file was for, or who issued a certification. */
  context: string;
  addedAt: string;
  status: string;
  tone: SupplierFileTone;
  /** The stored file to preview and download; certifications PMCM keeps on the supplier record have none. */
  objectId?: string;
  reviewReason?: string;
};

/** A file PMCM asked this supplier for that is not sent yet, or that PMCM sent back. */
export type SupplierNeededFile = {
  eventId: string;
  eventName: string;
  key: string;
  label: string;
  reviewReason?: string;
  dueDate?: string | null;
  overdue: boolean;
  /** Contracts are sent from the booking; other requirements take a file here. */
  bookingRequestId?: string;
  replacing: boolean;
};

const VERSION_STATUS: Record<string, Pick<SupplierLibraryFile, "status" | "tone">> = {
  submitted: { status: "Waiting for PMCM", tone: "attention" },
  approved: { status: "Approved", tone: "done" },
  rejected: { status: "Sent back", tone: "urgent" },
  replaced: { status: "Replaced", tone: "neutral" },
};

const CONTRACT_STATUS: Record<PrismSupplierContractVersion["reviewStatus"], Pick<SupplierLibraryFile, "status" | "tone">> = {
  submitted: { status: "Waiting for PMCM", tone: "attention" },
  accepted: { status: "Approved", tone: "done" },
  changes_requested: { status: "Changes requested", tone: "urgent" },
};

function isContractRow(row: SupplierFileRequirementRow) {
  return row.item.key.startsWith("supplier-contract:");
}

/** What PMCM still needs from this supplier: missing files and ones PMCM sent back, overdue first. */
export function buildSupplierNeededFiles(rows: SupplierFileRequirementRow[], eventNames: ReadonlyMap<string, string>): SupplierNeededFile[] {
  return rows
    .filter(({ item }) => item.status === "missing" || item.status === "pending" || item.validationStatus === "rejected")
    .filter((row) => isContractRow(row) || (row.item.origin === "custom" && row.item.ownerRole === "supplier"))
    .map((row) => ({
      eventId: row.eventId,
      eventName: eventNames.get(row.eventId) ?? "Assigned booking",
      key: row.item.key,
      label: isContractRow(row) ? "Signed contract" : row.item.label,
      ...(row.item.reviewReason ? { reviewReason: row.item.reviewReason } : {}),
      dueDate: row.item.dueDate,
      overdue: Boolean(row.item.overdue),
      ...(isContractRow(row) ? { bookingRequestId: row.requestIds[0] } : {}),
      replacing: Boolean(row.item.uploadedObjectId),
    }))
    .sort((left, right) => Number(right.overdue) - Number(left.overdue) || String(left.dueDate ?? "9999").localeCompare(String(right.dueDate ?? "9999")));
}

function requirementFiles(rows: SupplierFileRequirementRow[], eventNames: ReadonlyMap<string, string>): SupplierLibraryFile[] {
  return rows.filter((row) => !isContractRow(row)).flatMap(({ eventId, item }) => (item.versions ?? []).map((version) => ({
    id: version.documentId,
    name: version.fileName,
    kind: supplierFileKind(version.fileName),
    group: "booking" as const,
    context: `${eventNames.get(eventId) ?? "Assigned booking"} · ${item.label}`,
    addedAt: version.uploadedAt,
    ...(VERSION_STATUS[version.status] ?? { status: version.status, tone: "neutral" as const }),
    objectId: version.objectId,
    ...(version.reviewReason ? { reviewReason: version.reviewReason } : {}),
  })));
}

function contractFiles(contracts: PrismSupplierContractVersion[], eventNames: ReadonlyMap<string, string>): SupplierLibraryFile[] {
  return contracts.map((contract) => ({
    id: contract.id,
    name: contract.fileName,
    kind: supplierFileKind(contract.fileName, contract.mimeType),
    contentType: contract.mimeType,
    group: "contract",
    context: `${eventNames.get(contract.eventId) ?? "Assigned booking"} · Contract version ${contract.version}`,
    addedAt: contract.uploadedAt,
    ...CONTRACT_STATUS[contract.reviewStatus],
    objectId: contract.storedObjectId,
    ...(contract.reviewReason ? { reviewReason: contract.reviewReason } : {}),
  }));
}

function certificationStatus(certification: PrismSupplierCertification, now: Date): Pick<SupplierLibraryFile, "status" | "tone"> {
  if (!certification.expiresAt) return { status: certification.status ?? "On file", tone: "neutral" };
  const expires = new Date(certification.expiresAt);
  if (expires.getTime() < now.getTime()) return { status: "Expired", tone: "urgent" };
  const soon = expires.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;
  return { status: `Expires ${certification.expiresAt.slice(0, 10)}`, tone: soon ? "attention" : "neutral" };
}

function certificationFiles(certifications: PrismSupplierCertification[], now: Date): SupplierLibraryFile[] {
  return certifications.map((certification) => ({
    id: certification.id,
    name: certification.fileName,
    kind: supplierFileKind(certification.fileName),
    group: "certification",
    context: [certification.documentType ?? "Certification", certification.issuer].filter(Boolean).join(" · "),
    addedAt: certification.uploadedAt,
    ...certificationStatus(certification, now),
  }));
}

/** Every file this supplier has with PMCM, newest first: booking documents, contracts and certifications. */
export function buildSupplierFileLibrary(input: {
  rows: SupplierFileRequirementRow[];
  contracts: PrismSupplierContractVersion[];
  certifications: PrismSupplierCertification[];
  eventNames: ReadonlyMap<string, string>;
  now?: Date;
}): SupplierLibraryFile[] {
  return [
    ...requirementFiles(input.rows, input.eventNames),
    ...contractFiles(input.contracts, input.eventNames),
    ...certificationFiles(input.certifications, input.now ?? new Date()),
  ].sort((left, right) => right.addedAt.localeCompare(left.addedAt));
}

export function countSupplierFiles(files: SupplierLibraryFile[]): Record<SupplierFileFilter, number> {
  return {
    all: files.length,
    booking: files.filter((file) => file.group === "booking").length,
    contract: files.filter((file) => file.group === "contract").length,
    certification: files.filter((file) => file.group === "certification").length,
  };
}

export function filterSupplierFiles(files: SupplierLibraryFile[], filter: SupplierFileFilter, query: string) {
  const needle = query.trim().toLowerCase();
  return files.filter((file) => (filter === "all" || file.group === filter) && (!needle || `${file.name} ${file.context}`.toLowerCase().includes(needle)));
}
