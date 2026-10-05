import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';

const COUNT_QUERY = [
  'SELECT COUNT(*)::text AS orphan_count',
  'FROM supplier_ops.quotes AS quote',
  'LEFT JOIN supplier_ops.quote_requests AS request ON request.id = quote.request_id',
  'WHERE quote.request_id IS NOT NULL AND request.id IS NULL',
].join(' ');

const SAMPLE_QUERY = [
  'SELECT quote.id',
  'FROM supplier_ops.quotes AS quote',
  'LEFT JOIN supplier_ops.quote_requests AS request ON request.id = quote.request_id',
  'WHERE quote.request_id IS NOT NULL AND request.id IS NULL',
  'ORDER BY quote.id LIMIT $1',
].join(' ');

export async function findQuoteRequestOrphans(pool, { sampleLimit = 10 } = {}) {
  const countResult = await pool.query(COUNT_QUERY);
  const orphanCount = Number(countResult.rows[0]?.orphan_count ?? 0);
  if (!Number.isSafeInteger(orphanCount) || orphanCount < 0) {
    throw new Error('Quote-request orphan count was not a valid non-negative integer.');
  }
  if (orphanCount === 0) return { orphanCount, sampleQuoteIds: [] };

  const sampleResult = await pool.query(SAMPLE_QUERY, [sampleLimit]);
  return {
    orphanCount,
    sampleQuoteIds: sampleResult.rows.map((row) => String(row.id)),
  };
}

export function assertNoQuoteRequestOrphans(result) {
  if (result.orphanCount === 0) return;
  const sample = result.sampleQuoteIds.length > 0
    ? ' Sample quote IDs: ' + result.sampleQuoteIds.join(', ') + '.'
    : '';
  throw new Error(
    'Quote-request FK preflight found ' + result.orphanCount +
      ' orphan quote(s). Repair each record through the Commercial owner before applying the FK.' + sample,
  );
}

export async function runQuoteRequestFkPreflight({ env = process.env, PoolClass = Pool } = {}) {
  const database = selectDatabaseConnection({ purpose: 'migration', env });
  const pool = new PoolClass({
    connectionString: database.connectionString,
    ssl: database.ssl,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  try {
    const result = await findQuoteRequestOrphans(pool);
    assertNoQuoteRequestOrphans(result);
    console.log('Quote-request FK preflight passed for ' + database.target + ': no orphan quotes.');
    return result;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runQuoteRequestFkPreflight().catch(() => {
    console.error('Quote-request FK preflight could not complete. Check the direct database URL and API connection diagnostics.');
    process.exitCode = 1;
  });
}