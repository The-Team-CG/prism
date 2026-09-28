import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function digestJson(value: unknown): string {
  return digestSerializedText(canonicalJson(value));
}

export function digestJsonOrNull(value: unknown): string | null {
  try {
    return digestJson(value);
  } catch {
    return null;
  }
}

export function digestSerializedText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
