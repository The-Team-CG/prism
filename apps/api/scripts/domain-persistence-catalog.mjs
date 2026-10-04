import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OWNERSHIP_MANIFEST = join(SCRIPT_ROOT, 'prisma', 'domain-ownership.json');

export function loadOwnershipManifest(path = DEFAULT_OWNERSHIP_MANIFEST) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function domainPersistenceCatalog(manifest, { final = false } = {}) {
  if (!Array.isArray(manifest?.ownership) || manifest.ownership.length === 0) {
    throw new Error('domain ownership manifest must contain ownership rows');
  }

  const tables = manifest.ownership.map((entry) => {
    const schema = final ? entry.targetSchema : entry.currentSchema;
    if (!schema || !entry.table || !entry.domain || !entry.model) {
      throw new Error(`domain ownership row for ${entry.model ?? '(unknown model)'} is incomplete`);
    }
    return {
      model: entry.model,
      schema,
      table: entry.table,
      domain: entry.domain,
    };
  });

  const tableKeys = new Set();
  for (const entry of tables) {
    const key = `${entry.schema}.${entry.table}`;
    if (tableKeys.has(key)) throw new Error(`domain ownership manifest assigns ${key} more than once`);
    tableKeys.add(key);
  }

  return {
    final,
    tables,
    schemas: [...new Set(tables.map(({ schema }) => schema))].sort(),
  };
}
