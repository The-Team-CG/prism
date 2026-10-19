import { createHash } from 'node:crypto';

export const ADDENDUM_CONSENT_VERSION = 'addendum-conforme-acknowledgment-v1';
export const ADDENDUM_CONSENT_TEXT = 'I have reviewed this addendum conforme and acknowledge my approval for the scope and financial changes described above.';

type ComparisonChange = { key: string; before: unknown; after: unknown };

/** Client-safe snapshot: contract-level changes only. Supplier quote lines are PMCM cost data and never enter the signed text. */
export type AddendumConformeSnapshot = {
  eventName: string;
  versionNumber: number;
  title: string;
  summary: string;
  financialDelta: number;
  comparison: { contract: ComparisonChange[] };
};

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function describeChange(change: ComparisonChange) {
  if (change.before === null || change.before === undefined) return `added ${canonicalJson(change.after)}`;
  if (change.after === null || change.after === undefined) return `removed ${canonicalJson(change.before)}`;
  return `changed from ${canonicalJson(change.before)} to ${canonicalJson(change.after)}`;
}

function renderChanges(heading: string, changes: ComparisonChange[]) {
  if (changes.length === 0) return `${heading}: none recorded.`;
  return [`${heading}:`, ...changes.map((change) => `- ${change.key}: ${describeChange(change)}`)].join('\n');
}

function renderDelta(delta: number) {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `PHP ${sign}${Math.abs(delta).toLocaleString('en-US')}`;
}

/** Deterministic client-safe text of the addendum version; the SHA-256 of this text is what both parties sign. */
export function buildAddendumConformeDocument(snapshot: AddendumConformeSnapshot) {
  const content = [
    `ADDENDUM CONFORME - Version ${snapshot.versionNumber}`,
    '',
    `Event: ${snapshot.eventName}`,
    `Addendum: ${snapshot.title}`,
    `Summary: ${snapshot.summary || 'Scope change recorded'}`,
    `Financial change: ${renderDelta(snapshot.financialDelta)}`,
    '',
    renderChanges('Contract changes', snapshot.comparison.contract),
    '',
    'By acknowledging this addendum conforme you confirm that you reviewed this version and agree to the changes above. The acknowledgment is recorded against this document version; PMCM countersigns after the client.',
  ].join('\n');
  return { content, sha256: sha256(content) };
}
