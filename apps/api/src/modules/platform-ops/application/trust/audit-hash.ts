import { createHash } from 'node:crypto';

const CANONICAL_AUDIT_HASH_PREFIX = 'prism:audit-chain:v2\u0000';

export type AuditHashRow = {
  id: string;
  eventId: string | null;
  actor: string;
  actorRole: string;
  actorEmail: string | null;
  action: string;
  actionType: string;
  category: string;
  affectedType: string | null;
  affectedId: string | null;
  affectedLabel: string | null;
  metadata: unknown;
  ipAddress: string;
  device: string;
  severity: string;
  immutableHash: string;
  previousHash: string | null;
  createdAt: Date | string;
};

export function toAuditHashPayload(row: AuditHashRow) {
  return {
    id: row.id,
    eventId: row.eventId ?? null,
    actor: row.actor,
    actorRole: row.actorRole,
    actorEmail: row.actorEmail ?? null,
    action: row.action,
    actionType: row.actionType,
    category: row.category,
    affectedType: row.affectedType ?? null,
    affectedId: row.affectedId ?? null,
    affectedLabel: row.affectedLabel ?? null,
    metadata: row.metadata ?? {},
    ipAddress: row.ipAddress,
    device: row.device,
    severity: row.severity,
    previousHash: row.previousHash ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function hashCanonicalAuditPayload(payload: Record<string, unknown>) {
  return createHash('sha256')
    .update(CANONICAL_AUDIT_HASH_PREFIX)
    .update(JSON.stringify(canonicalizeJson(payload)))
    .digest('hex');
}

export function hashLegacyAuditPayload(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function isAuditHashValid(row: AuditHashRow) {
  const payload = toAuditHashPayload(row);
  return row.immutableHash === hashCanonicalAuditPayload(payload)
    || row.immutableHash === hashLegacyAuditPayload(payload);
}

function canonicalizeJson(value: unknown): unknown {
  // JSONB stores the serialized form, so dates and similar values hash the way they are stored.
  if (value && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return canonicalizeJson((value as { toJSON: () => unknown }).toJSON());
  }
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => [key, canonicalizeJson(entry)]));
}
