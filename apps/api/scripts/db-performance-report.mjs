import process from 'node:process';
import { Pool } from 'pg';

function connectionString() {
  const candidates = [process.env.PRISMA_DATABASE_URL, process.env.DIRECT_URL, process.env.SUPABASE_DB_URL, process.env.DATABASE_URL];
  const value = candidates.map((item) => item?.trim()).find(Boolean);
  if (!value) {
    console.error('No database URL configured. Set PRISMA_DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, or DATABASE_URL.');
    process.exit(1);
  }
  return value;
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function redactQueryText(query) {
  return String(query)
    .replace(/\b(password\s+)'[^']*'/gi, "$1'<redacted>'")
    .replace(/\bpostgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://<redacted>')
    .replace(/(:\/\/[^:\s'"]+:)[^@\s'"]+@/g, '$1<redacted>@');
}

try {
  const enabled = await pool.query(`
    select coalesce(
      to_regclass('public.pg_stat_statements')::text,
      to_regclass('extensions.pg_stat_statements')::text
    ) as relation
  `);
  const relation = enabled.rows[0]?.relation;
  if (!relation) {
    console.log('pg_stat_statements is not enabled or not visible to this role. Performance report skipped.');
    process.exit(0);
  }

  async function topStatements(orderColumn) {
    const result = await pool.query(`
      select calls, rows, total_exec_time, mean_exec_time,
        left(regexp_replace(query, '\\s+', ' ', 'g'), 180) as query
      from ${relation}
      where query not ilike '%pg_stat_statements%'
      order by ${orderColumn} desc
      limit 20;
    `);
    return result.rows;
  }

  function reportRows(rows) {
    return rows.map((row) => ({
      calls: Number(row.calls),
      rows: Number(row.rows),
      total_ms: Number(row.total_exec_time).toFixed(2),
      mean_ms: Number(row.mean_exec_time).toFixed(2),
      query: redactQueryText(row.query),
    }));
  }

  const [byTotalTime, byMeanTime] = await Promise.all([
    topStatements('total_exec_time'),
    topStatements('mean_exec_time'),
  ]);
  console.log('Top 20 by cumulative execution time:');
  console.table(reportRows(byTotalTime));
  console.log('Top 20 by mean execution time:');
  console.table(reportRows(byMeanTime));
} finally {
  await pool.end();
}
