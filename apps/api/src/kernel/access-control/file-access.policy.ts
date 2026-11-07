import { OpsUserRole } from '@prism/kernel/event-core';

/**
 * One file-access policy for event file lists, downloads, requirement-matrix
 * references, and client document rows. Pure functions only: callers load the
 * facts, and the event-level gate (assignment, booking, portal lock) is applied
 * before these run. Default deny: a file kind not listed here is never visible.
 */

/** Stored-object facts the policy reads. OpsStoredObject rows satisfy this shape. */
export type FileAccessObject = {
  usage: string;
  ownerRecordType: string;
  ownerRecordId: string;
  lifecycleState: string;
  deletedAt: Date | null;
};

/** Supported file kinds. Game media, lobby branding, and guest feedback media are outside this policy. */
export type FileAccessKind = 'signed_conforme' | 'client_document' | 'billing_statement' | 'proposal_deliverable' | 'supplier_document';

export type FileAccessActor = { role: string; supplierId?: string | null };

export type FileAccessContext = {
  /** visibleToRoles of every file requirement the object is bound to; each list must admit the actor. */
  requirementVisibility: ReadonlyArray<readonly string[]>;
  /** The billing statement that owns a billing deliverable has `sentAt` set. */
  billingStatementSent: boolean;
};

/** A requirement key derived from a stored object's owner and usage; custom keys come from document bindings. */
const DERIVED_REQUIREMENT_KEY_BY_OWNER_USAGE: Readonly<Record<string, string>> = {
  'event:signed_conforme': 'signed_conforme',
  'billing_statement:event_deliverable': 'billing_statement',
};

const PRIVILEGED_ROLES: readonly string[] = [OpsUserRole.PmcmAdmin, OpsUserRole.System];
const LISTABLE_LIFECYCLES: readonly string[] = ['requested', 'stored', 'failed'];
const PROPOSAL_DOCUMENT_TYPES: readonly string[] = ['proposal', 'ce_proposal', 'briefing_proposal'];

/** Supported owner and usage pairs. Any other pair is outside the policy and denied. */
const KIND_BY_OWNER_USAGE: ReadonlyMap<string, FileAccessKind> = new Map<string, FileAccessKind>([
  ['event:signed_conforme', 'signed_conforme'],
  ['event:client_document', 'client_document'],
  ['billing_statement:event_deliverable', 'billing_statement'],
  ['proposal_version:event_deliverable', 'proposal_deliverable'],
  ['supplier:supplier_document', 'supplier_document'],
]);

export function fileAccessKindOf(object: Pick<FileAccessObject, 'usage' | 'ownerRecordType'>): FileAccessKind | null {
  return KIND_BY_OWNER_USAGE.get(`${object.ownerRecordType}:${object.usage}`) ?? null;
}

/** Non-privileged object access per kind. PMCM and System bypass these rules. */
const KIND_ACCESS: Record<FileAccessKind, (actor: FileAccessActor, object: FileAccessObject, context: FileAccessContext) => boolean> = {
  signed_conforme: (actor) => actor.role === OpsUserRole.Client,
  client_document: (actor) => actor.role === OpsUserRole.Client || actor.role === OpsUserRole.Coordinator,
  billing_statement: (actor, _object, context) => actor.role === OpsUserRole.Client && context.billingStatementSent,
  proposal_deliverable: (actor) => actor.role === OpsUserRole.Client,
  supplier_document: (actor, object) => actor.role === OpsUserRole.Supplier && Boolean(actor.supplierId) && object.ownerRecordId === actor.supplierId,
};

/**
 * Visibility lists for every requirement an object is bound to: its derived key
 * (signed conforme, billing statement) and each custom key whose document binds it.
 */
export function requirementVisibilityFor(
  object: Pick<FileAccessObject, 'usage' | 'ownerRecordType'>,
  boundDocumentTypes: readonly string[],
  visibility: Readonly<Record<string, readonly string[]>>,
): Array<readonly string[]> {
  const keys = new Set(boundDocumentTypes);
  const derived = DERIVED_REQUIREMENT_KEY_BY_OWNER_USAGE[`${object.ownerRecordType}:${object.usage}`];
  if (derived) keys.add(derived);
  return [...keys].flatMap((key) => (visibility[key] ? [visibility[key]] : []));
}

/** Object-level access by role and ownership, ignoring lifecycle. Write paths reuse this for their own requested uploads. */
export function canAccessStoredObject(actor: FileAccessActor, object: FileAccessObject, context: FileAccessContext): boolean {
  const kind = fileAccessKindOf(object);
  if (!kind) return false;
  if (PRIVILEGED_ROLES.includes(actor.role)) return true;
  if (!context.requirementVisibility.every((roles) => roles.includes(actor.role))) return false;
  return KIND_ACCESS[kind](actor, object, context);
}

/**
 * Lists show a non-PMCM role only stored objects it may download. PMCM also
 * sees requested and failed uploads so it can chase them.
 */
export function canListStoredObject(actor: FileAccessActor, object: FileAccessObject, context: FileAccessContext): boolean {
  if (object.deletedAt) return false;
  if (PRIVILEGED_ROLES.includes(actor.role)) {
    return LISTABLE_LIFECYCLES.includes(object.lifecycleState) && canAccessStoredObject(actor, object, context);
  }
  return object.lifecycleState === 'stored' && canAccessStoredObject(actor, object, context);
}

/**
 * Download authorization is object access. Refusals for states that are not
 * stored, or that are deleted, stay in the storage service and keep their codes.
 * For a stored object a non-PMCM role is authorized exactly when it sees it in a list.
 */
export function canDownloadStoredObject(actor: FileAccessActor, object: FileAccessObject, context: FileAccessContext): boolean {
  return canAccessStoredObject(actor, object, context);
}

/** Stored-object-free document row (OpsDocument): the row's type and binding decide, the bound object gates the rest. */
export type DocumentRowFacts = { type: string; storageKey: string | null };

/**
 * Whether a document metadata row may appear for an actor. Rows bound to a
 * stored object follow that object's list rule. Rows without an object follow
 * their type. A supplier contract row never reaches a non-PMCM role.
 */
export function canReadDocumentRow(
  actor: FileAccessActor,
  row: DocumentRowFacts,
  bound: { object: FileAccessObject | null } & FileAccessContext,
): boolean {
  if (PRIVILEGED_ROLES.includes(actor.role)) return true;
  if (row.type === 'supplier_contract') return false;
  if (row.type === 'billing_statement') return actor.role === OpsUserRole.Client && bound.billingStatementSent;
  if (row.storageKey) return bound.object !== null && canListStoredObject(actor, bound.object, bound);
  return actor.role === OpsUserRole.Client && (row.type === 'signed_conforme' || PROPOSAL_DOCUMENT_TYPES.includes(row.type));
}
