import type { PrismFileRequirementItem, PrismFileRequirementStatus, PrismSupplierFileRequirementFulfilment, PrismSupplierRequirementVersion } from '@prism/types';

/** A matrix item as derived from workflow records, before PMCM overrides are applied. */
export type DerivedFileRequirementItem = Omit<PrismFileRequirementItem, 'required' | 'overdue' | 'origin' | 'revision' | 'validationStatus' | 'notes'>;

export type PersistedFileRequirement = {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
  targetSupplierIds?: string[];
  required: boolean;
  dueAt: Date | null;
  sourceWorkflow: string;
  isCustom: boolean;
  notes: string | null;
  revision: number;
};

export type FileRequirementDocumentFact = {
  id: string;
  type: string;
  status: string;
  validationStatus: string;
  rejectionReason?: string | null;
  uploadedAt: Date;
  fileName?: string;
  /** Stored object behind a bound upload, when the document came from storage. */
  storageKey?: string | null;
  /** Stored bytes may be removed independently of the document metadata. */
  available?: boolean;
  /** Supplier that owns the stored object behind this document; absent for event-owned or unbound files. */
  ownerSupplierId?: string | null;
};

export type FileRequirementSupplier = { supplierId: string; supplierName: string };

const SATISFIED_STATUSES: ReadonlySet<PrismFileRequirementStatus> = new Set(['submitted', 'generated', 'approved', 'complete']);

export function isFileRequirementSatisfied(status: PrismFileRequirementStatus) {
  return SATISFIED_STATUSES.has(status);
}

/** Required, unsatisfied, and past its due date. Optional items are never overdue. */
export function isFileRequirementOverdue(item: Pick<PrismFileRequirementItem, 'required' | 'status' | 'dueDate'>, now: Date) {
  if (!item.required || !item.dueDate || isFileRequirementSatisfied(item.status)) return false;
  return new Date(item.dueDate).getTime() < now.getTime();
}

function latestDocument(documents: FileRequirementDocumentFact[], key: string) {
  return documents
    .filter((document) => document.type === key && document.available !== false)
    .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime() || left.id.localeCompare(right.id))[0];
}

function validationOf(document: FileRequirementDocumentFact | undefined): PrismFileRequirementItem['validationStatus'] {
  if (!document) return undefined;
  // A file fails either the upload check or PMCM's review; both leave the requirement needing a replacement.
  return document.validationStatus === 'rejected' || document.status === 'rejected' ? 'rejected' : 'accepted';
}

/** Every available upload for one requirement, newest first, with PMCM's reason on each rejected one. */
function requirementVersions(documents: FileRequirementDocumentFact[], key: string): PrismSupplierRequirementVersion[] {
  return documents.filter((document) => document.type === key && document.available !== false && document.storageKey)
    .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime() || left.id.localeCompare(right.id))
    .map((document) => ({
      documentId: document.id, objectId: document.storageKey!, fileName: document.fileName ?? 'Submitted file',
      uploadedAt: document.uploadedAt.toISOString(), status: document.status,
      ...(document.status === 'rejected' && document.rejectionReason ? { reviewReason: document.rejectionReason } : {}),
    }));
}

function rejectionReasonOf(document: FileRequirementDocumentFact | undefined) {
  return (document?.status === 'rejected' || document?.validationStatus === 'rejected') && document.rejectionReason ? document.rejectionReason : undefined;
}

function customItem(row: PersistedFileRequirement, documents: FileRequirementDocumentFact[]): DerivedFileRequirementItem {
  const latest = latestDocument(documents, row.key);
  const rejected = latest?.validationStatus === 'rejected' || latest?.status === 'rejected';
  const status: PrismFileRequirementStatus = !latest || rejected ? 'missing' : latest.status === 'approved' ? 'approved' : 'submitted';
  const count = documents.filter((document) => document.type === row.key && document.available !== false).length;
  return {
    key: row.key,
    label: row.label,
    ownerRole: row.ownerRole,
    visibleToRoles: row.visibleToRoles,
    sourceWorkflow: row.sourceWorkflow,
    status,
    uploadedAssetId: latest?.id,
    ...(latest?.storageKey ? { uploadedObjectId: latest.storageKey } : {}),
    auditCategory: 'documents',
    detail: rejected
      ? 'The latest upload was rejected; a replacement file is required.'
      : latest ? `${count} file(s) submitted` : 'No file submitted yet.',
    ...customItemHistory(documents, row.key, rejected ? latest : undefined),
  };
}

/** PMCM's reason on a rejected latest upload, and every upload so far, for the party that owns the requirement. */
function customItemHistory(documents: FileRequirementDocumentFact[], key: string, rejectedLatest: FileRequirementDocumentFact | undefined) {
  const reviewReason = rejectionReasonOf(rejectedLatest);
  const versions = requirementVersions(documents, key);
  return { ...(reviewReason ? { reviewReason } : {}), ...(versions.length ? { versions } : {}) };
}

/** One selected supplier's fulfilment, computed only from documents whose stored object that supplier owns. */
function supplierFulfilment(
  row: PersistedFileRequirement,
  supplier: FileRequirementSupplier,
  documents: FileRequirementDocumentFact[],
  now: Date,
): PrismSupplierFileRequirementFulfilment {
  const owned = documents.filter((document) => document.ownerSupplierId === supplier.supplierId);
  const { status, uploadedAssetId, uploadedObjectId } = customItem(row, owned);
  const validationStatus = validationOf(latestDocument(owned, row.key));
  const latest = latestDocument(owned, row.key);
  const versions = requirementVersions(owned, row.key);
  const fulfilment: PrismSupplierFileRequirementFulfilment = {
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    status,
    overdue: false,
    ...(validationStatus ? { validationStatus } : {}),
    ...(uploadedAssetId ? { uploadedAssetId } : {}),
    ...(uploadedObjectId ? { uploadedObjectId } : {}),
    ...(rejectionReasonOf(latest) ? { reviewReason: rejectionReasonOf(latest) } : {}),
    versions,
  };
  return { ...fulfilment, overdue: isFileRequirementOverdue({ required: row.required, status, dueDate: row.dueAt?.toISOString() }, now) };
}

/** The top-level status of a supplier-owned requirement: approved only when every selected supplier is approved. */
function aggregateSupplierStatus(fulfilments: PrismSupplierFileRequirementFulfilment[]): PrismFileRequirementStatus {
  if (fulfilments.length === 0) return 'missing';
  if (fulfilments.every((fulfilment) => fulfilment.status === 'approved')) return 'approved';
  if (fulfilments.every((fulfilment) => isFileRequirementSatisfied(fulfilment.status))) return 'submitted';
  return 'missing';
}

/** A supplier-owned custom requirement: one definition per event, fulfilled separately by each selected supplier. */
function supplierOwnedItem(
  row: PersistedFileRequirement,
  suppliers: FileRequirementSupplier[],
  documents: FileRequirementDocumentFact[],
  now: Date,
): PrismFileRequirementItem {
  const targets = row.targetSupplierIds ?? [];
  const fulfilments = suppliers.filter((supplier) => targets.length === 0 || targets.includes(supplier.supplierId))
    .map((supplier) => supplierFulfilment(row, supplier, documents, now));
  const satisfied = fulfilments.filter((fulfilment) => isFileRequirementSatisfied(fulfilment.status)).length;
  const item: PrismFileRequirementItem = {
    key: row.key,
    label: row.label,
    ownerRole: row.ownerRole,
    visibleToRoles: row.visibleToRoles,
    sourceWorkflow: row.sourceWorkflow,
    status: aggregateSupplierStatus(fulfilments),
    required: row.required,
    dueDate: row.dueAt?.toISOString(),
    overdue: false,
    origin: 'custom',
    revision: row.revision,
    supplierFulfilments: fulfilments,
    targetSupplierIds: targets,
    auditCategory: 'documents',
    detail: fulfilments.length === 0
      ? 'No supplier is selected on this event.'
      : `${satisfied} of ${fulfilments.length} selected supplier(s) submitted`,
    ...(row.notes ? { notes: row.notes } : {}),
  };
  return { ...item, overdue: isFileRequirementOverdue(item, now) };
}

/**
 * Applies PMCM overrides (owner, visibility, required state, due date, notes)
 * onto derived items, appends custom requirements, and computes overdue state.
 * Derived status and labels always follow their source workflow. Supplier-owned
 * custom requirements are fulfilled per entry in `suppliers`.
 */
export function mergeFileRequirementOverrides(
  derived: DerivedFileRequirementItem[],
  persisted: PersistedFileRequirement[],
  documents: FileRequirementDocumentFact[],
  suppliers: FileRequirementSupplier[],
  now: Date,
): PrismFileRequirementItem[] {
  const derivedKeys = new Set(derived.map((item) => item.key));
  const byKey = new Map(persisted.map((row) => [row.key, row]));
  const custom = persisted
    .filter((row) => row.isCustom && !derivedKeys.has(row.key))
    .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));

  const merge = (base: DerivedFileRequirementItem, row: PersistedFileRequirement | undefined, origin: 'derived' | 'custom'): PrismFileRequirementItem => {
    const item: PrismFileRequirementItem = {
      ...base,
      ownerRole: row?.ownerRole ?? base.ownerRole,
      visibleToRoles: row?.visibleToRoles ?? base.visibleToRoles,
      required: row?.required ?? true,
      dueDate: row?.dueAt?.toISOString() ?? base.dueDate,
      overdue: false,
      origin,
      revision: row?.revision ?? 0,
      validationStatus: validationOf(latestDocument(documents, base.key)),
      ...(row?.notes ? { notes: row.notes } : {}),
    };
    return { ...item, overdue: isFileRequirementOverdue(item, now) };
  };

  return [
    ...derived.map((item) => merge(item, byKey.get(item.key), 'derived')),
    ...custom.map((row) => (row.ownerRole === 'supplier'
      ? supplierOwnedItem(row, suppliers, documents, now)
      : merge(customItem(row, documents), row, 'custom'))),
  ];
}

/** Read-path projection: strip PMCM-only fields and items outside the actor role's visibility. */
export function visibleFileRequirementItems(items: PrismFileRequirementItem[], role: string): PrismFileRequirementItem[] {
  const privileged = role === 'pmcm-admin' || role === 'system';
  return items
    .filter((item) => privileged || item.visibleToRoles.includes(role))
    .map((item) => {
      if (privileged) return item;
      const { notes: _notes, targetSupplierIds: _targets, ...shared } = item;
      return shared;
    });
}

function ownFulfilmentDetail(fulfilment: PrismSupplierFileRequirementFulfilment) {
  if (fulfilment.validationStatus === 'rejected' || fulfilment.reviewReason) return 'The latest upload was rejected; a replacement file is required.';
  if (fulfilment.status === 'approved') return 'Your file has been approved.';
  return isFileRequirementSatisfied(fulfilment.status) ? 'Your file has been submitted.' : 'No file submitted yet.';
}

/**
 * Narrows items to what one actor may see of per-supplier fulfilment; apply after `visibleFileRequirementItems`.
 * A supplier sees only its own entry, folded into the item with no other supplier's status, ids or names,
 * and loses the item entirely when it has no entry. Every other non-PMCM role keeps the aggregate, without breakdown.
 */
export function scopeFileRequirementItemsForActor(
  items: PrismFileRequirementItem[],
  actor: { role: string; supplierId?: string | null },
): PrismFileRequirementItem[] {
  if (actor.role === 'pmcm-admin' || actor.role === 'system') return items;
  return items.flatMap((item) => {
    const { supplierFulfilments, uploadedAssetId: _asset, uploadedObjectId: _object, validationStatus: _validation, ...shared } = item;
    if (!supplierFulfilments) return [item];
    if (actor.role !== 'supplier') return [shared];
    const own = supplierFulfilments.find((fulfilment) => fulfilment.supplierId === actor.supplierId);
    if (!own) return [];
    return [{
      ...shared,
      status: own.status,
      overdue: own.overdue,
      detail: ownFulfilmentDetail(own),
      ...(own.validationStatus ? { validationStatus: own.validationStatus } : {}),
      ...(own.uploadedAssetId ? { uploadedAssetId: own.uploadedAssetId } : {}),
      ...(own.uploadedObjectId ? { uploadedObjectId: own.uploadedObjectId } : {}),
      ...(own.reviewReason ? { reviewReason: own.reviewReason } : {}),
      ...(own.versions ? { versions: own.versions } : {}),
    }];
  });
}
