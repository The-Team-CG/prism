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

try {
  const result = await pool.query(`
    with foreign_keys as (
      select
        c.conrelid,
        c.conname,
        n.nspname as schema_name,
        r.relname as table_name,
        c.conkey
      from pg_constraint c
      join pg_class r on r.oid = c.conrelid
      join pg_namespace n on n.oid = r.relnamespace
      where c.contype = 'f'
        and n.nspname in ('floorplan', 'identity', 'event_core', 'supplier_ops', 'staffing_ops', 'finance_ops', 'compliance_ops', 'guest_ops', 'trust_ops')
    )
    select schema_name, table_name, conname
    from foreign_keys fk
    where not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and (select array_agg(attnum order by ord)::int2[]
             from unnest(i.indkey) with ordinality as indexed(attnum, ord)
             where ord <= array_length(fk.conkey, 1)) = fk.conkey
    )
    order by schema_name, table_name, conname;
  `);

  if (result.rows.length > 0) {
    console.error('Foreign keys missing supporting leading indexes:');
    for (const row of result.rows) console.error(`- ${row.schema_name}.${row.table_name}: ${row.conname}`);
    process.exit(1);
  }

  console.log('FK index audit passed.');
} finally {
  await pool.end();
}