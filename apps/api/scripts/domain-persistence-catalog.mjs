import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OWNERSHIP_MANIFEST = join(SCRIPT_ROOT, 'prisma', 'domain-ownership.json');
export const OWNER_TABLE_REFERENCE_PATTERN = /\{\{([a-z][a-z0-9-]*)\.([a-z_][a-z0-9_]*)\}\}/g;

export function loadOwnershipManifest(path = DEFAULT_OWNERSHIP_MANIFEST) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(label + ' must be a PostgreSQL identifier');
  }
}

export function ownerTableReference(manifest, domain, table, { final = false } = {}) {
  const matches = (manifest?.ownership ?? []).filter((entry) => entry.domain === domain && entry.table === table);
  if (matches.length !== 1) {
    throw new Error('ownership manifest must map ' + domain + '.' + table + ' exactly once');
  }
  const entry = matches[0];
  const schema = final ? entry.targetSchema : entry.currentSchema;
  assertIdentifier(schema, 'schema for ' + domain + '.' + table);
  assertIdentifier(table, 'table for ' + domain + '.' + table);
  return { ...entry, schema };
}

export function renderOwnerTableReferences(sql, manifest, { final = false } = {}) {
  if (typeof sql !== 'string') throw new Error('SQL must be a string');
  const rendered = sql.replace(OWNER_TABLE_REFERENCE_PATTERN, (_token, domain, table) => {
    const owner = ownerTableReference(manifest, domain, table, { final });
    return '"' + owner.schema + '"."' + owner.table + '"';
  });
  if (/\{\{[a-z][a-z0-9-]*\.[a-z_][a-z0-9_]*\}\}/i.test(rendered)) {
    throw new Error('SQL contains an unresolved owner table reference');
  }
  return rendered;
}

export function domainPersistenceCatalog(manifest, { final = false } = {}) {
  if (!Array.isArray(manifest?.ownership) || manifest.ownership.length === 0) {
    throw new Error('domain ownership manifest must contain ownership rows');
  }

  const activeOwnership = manifest.ownership.filter((entry) => final || !entry.introducedAfterCutover);
  const tables = activeOwnership.map((entry) => {
    const schema = final ? entry.targetSchema : entry.currentSchema;
    if (!schema || !entry.table || !entry.domain || !entry.model) {
      throw new Error('domain ownership row for ' + (entry.model ?? '(unknown model)') + ' is incomplete');
    }
    assertIdentifier(schema, 'schema for ' + entry.model);
    assertIdentifier(entry.table, 'table for ' + entry.model);
    return {
      model: entry.model,
      schema,
      table: entry.table,
      domain: entry.domain,
    };
  });

  const tableKeys = new Set();
  for (const entry of tables) {
    const key = entry.schema + '.' + entry.table;
    if (tableKeys.has(key)) throw new Error('domain ownership manifest assigns ' + key + ' more than once');
    tableKeys.add(key);
  }

  return {
    final,
    tables,
    schemas: [...new Set(tables.map(({ schema }) => schema))].sort(),
  };
}
