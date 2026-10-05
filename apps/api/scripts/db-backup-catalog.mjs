import { domainPersistenceCatalog } from './domain-persistence-catalog.mjs';

export const SYSTEM_BACKUP_TABLES = Object.freeze([
  { schema: 'public', table: '_prisma_migrations', domain: 'prisma', model: 'PrismaMigrationLedger' },
]);

export function buildJsonBackupCatalog(manifest, { final = false } = {}) {
  const persistence = domainPersistenceCatalog(manifest, { final });
  const tables = [
    ...persistence.tables,
    ...SYSTEM_BACKUP_TABLES,
  ];
  const keys = new Set();
  for (const entry of tables) {
    const key = entry.schema + '.' + entry.table;
    if (keys.has(key)) throw new Error('JSON backup catalog contains duplicate table ' + key);
    keys.add(key);
  }

  return {
    final,
    schemas: [...new Set(tables.map(({ schema }) => schema))].sort(),
    tables,
  };
}
