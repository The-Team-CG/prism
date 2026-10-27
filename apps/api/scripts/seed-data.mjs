import { readFileSync } from 'node:fs';
import { accountRows } from '../src/fixtures/seed-accounts.mjs';
import { inspectMigrationHistory } from './db-migration-history.mjs';

export const portalRows = JSON.parse(readFileSync(new URL('../src/fixtures/portal-uat.json', import.meta.url), 'utf8'));
const quote = value => `"${value}"`;

function expectedQuery(row) {
  return `WITH scenario AS (SELECT $1::timestamptz AS anchor, $2::text AS password),
    expected (${row.columns.map(quote).join(', ')}) AS (SELECT ${row.select})`;
}

export async function inspectRows(client, rows, anchor) {
  const inspected = [];
  for (const row of rows) {
    const result = await client.query(`${expectedQuery(row)}
      SELECT to_jsonb(e) AS expected, to_jsonb(t) AS actual FROM expected e
      LEFT JOIN ${row.table} t ON t.${quote(row.key)} = e.${quote(row.key)}`, [anchor, '']);
    const { expected, actual } = result.rows[0];
    if (actual && row.identity.some(column => actual[column] !== expected[column])) {
      throw new Error(`Fixture identity collision in ${row.table}: ${expected[row.key]}. No records were changed.`);
    }
    inspected.push({ row, key: expected[row.key], present: Boolean(actual) });
  }
  return inspected;
}

export async function seedProfile(client, { profile, anchor, mode = 'apply', passwordFor = () => '' }) {
  const readOnly = mode !== 'apply';
  await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    // Prisma's timestamp-without-time-zone columns store UTC wall-clock values.
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    if (!readOnly) await client.query("SELECT pg_advisory_xact_lock(hashtext('prism-cli-fixtures-v1'))");
    const history = await inspectMigrationHistory(client);
    if (history.issues.length) throw new Error('Migration history needs review. Run db:doctor -- --mode=runtime --migration-history before seeding.');
    const accounts = await inspectRows(client, accountRows, anchor);
    const prerequisites = accounts.filter(item => !item.present);
    if (profile === 'portal-uat' && prerequisites.length) {
      throw new Error(`Missing account/profile prerequisites: ${prerequisites.map(item => item.key).join(', ')}. Run the accounts profile first.`);
    }
    const inspected = profile === 'accounts' ? accounts : await inspectRows(client, portalRows, anchor);
    const missing = inspected.filter(item => !item.present);
    // Resolve every required password before the first write. Existing users are never updated.
    const passwords = new Map(await Promise.all(missing.filter(item => item.row.passwordKey).map(async item => [item.key, readOnly ? '' : await passwordFor(item.row.passwordKey)])));
    let inserted = 0;
    if (!readOnly) {
      for (const { row, key } of missing) {
        const result = await client.query(`${expectedQuery(row)} INSERT INTO ${row.table} (${row.columns.map(quote).join(', ')})
          SELECT * FROM expected RETURNING ${quote(row.key)}`, [anchor, passwords.get(key) ?? '']);
        inserted += result.rowCount;
      }
    }
    await client.query('COMMIT');
    return { profile, mode, expected: inspected.length, existing: inspected.length - missing.length,
      missing: readOnly ? missing.map(item => `${item.row.table}/${item.key}`) : [], inserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
