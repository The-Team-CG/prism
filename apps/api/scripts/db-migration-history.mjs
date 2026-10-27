import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

export function migrationChecksums(sql) {
  const lf = sql.toString().replaceAll('\r\n', '\n');
  return [...new Set([sql, lf, lf.replaceAll('\n', '\r\n')].map(value => createHash('sha256').update(value).digest('hex')))];
}

export function localMigrationChecksums(directory = new URL('../prisma/migrations/', import.meta.url)) {
  return new Map(readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => {
    const sql = readFileSync(new URL(`${item.name}/migration.sql`, directory));
    return [item.name, migrationChecksums(sql)];
  }));
}

export function compareMigrationHistory(local, applied) {
  const issues = [];
  const lineEndingOnly = [];
  const finished = new Map();
  for (const row of applied.filter(item => !item.rolled_back_at)) {
    if (!row.finished_at) issues.push({ migration: row.migration_name, issue: 'unfinished' });
    else finished.set(row.migration_name, row.checksum);
  }
  for (const [name, checksum] of local) {
    const candidates = Array.isArray(checksum) ? checksum : [checksum];
    if (!finished.has(name)) issues.push({ migration: name, issue: 'pending' });
    else if (!candidates.includes(finished.get(name))) issues.push({ migration: name, issue: 'checksum-mismatch' });
    else if (finished.get(name) !== candidates[0]) lineEndingOnly.push(name);
  }
  for (const name of finished.keys()) {
    if (!local.has(name)) issues.push({ migration: name, issue: 'missing-local-file' });
  }
  return { local: local.size, applied: finished.size, lineEndingOnly, issues };
}

export async function inspectMigrationHistory(client) {
  const { rows } = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at');
  return compareMigrationHistory(localMigrationChecksums(), rows);
}
