import type { PrismFileRequirementItem, PrismFileRequirementStatus } from '@prism/types';

/** A matrix item as derived from workflow records, before PMCM overrides are applied. */
export type DerivedFileRequirementItem = Omit<PrismFileRequirementItem, 'required' | 'overdue' | 'origin' | 'revision' | 'validationStatus' | 'notes'>;

export type PersistedFileRequirement = {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
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
  uploadedAt: Date;
  /** Stored object behind a bound upload, when the document came from storage. */
  storageKey?: string | null;
  /** Stored bytes may be removed independently of the document metadata. */
  available?: boolean;
};

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
  return document.validationStatus === 'rejected' ? 'rejected' : 'accepted';
}

function customItem(row: PersistedFileRequirement, documents: FileRequirementDocumentFact[]): DerivedFileRequirementItem {
  const latest = latestDocument(documents, row.key);
  const rejected = latest?.validationStatus === 'rejected';
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
  };
}

/**
 * Applies PMCM overrides (owner, visibility, required state, due date, notes)
 * onto derived items, appends custom requirements, and computes overdue state.
 * Derived status and labels always follow their source workflow.
 */
export function mergeFileRequirementOverrides(
  derived: DerivedFileRequirementItem[],
  persisted: PersistedFileRequirement[],
  documents: FileRequirementDocumentFact[],
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
    ...custom.map((row) => merge(customItem(row, documents), row, 'custom')),
  ];
}

/** Read-path projection: strip PMCM-only fields and items outside the actor role's visibility. */
export function visibleFileRequirementItems(items: PrismFileRequirementItem[], role: string): PrismFileRequirementItem[] {
  const privileged = role === 'pmcm-admin' || role === 'system';
  return items
    .filter((item) => privileged || item.visibleToRoles.includes(role))
    .map((item) => {
      if (privileged) return item;
      const { notes: _notes, ...shared } = item;
      return shared;
    });
}
