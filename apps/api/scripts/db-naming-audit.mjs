import process from 'node:process';
import { Pool } from 'pg';

const domainSchemas = ['floorplan', 'identity', 'event_core', 'supplier_ops', 'staffing_ops', 'finance_ops', 'compliance_ops', 'guest_ops', 'trust_ops'];
const identifierPattern = /^[a-z_][a-z0-9_]*$/;

function connectionString() {
  const candidates = [process.env.PRISMA_DATABASE_URL, process.env.DIRECT_URL, process.env.SUPABASE_DB_URL, process.env.DATABASE_URL];
  const value = candidates.map((item) => item?.trim()).find(Boolean);
  if (!value) {
    console.error('No database URL configured. Set PRISMA_DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, or DATABASE_URL.');
    process.exit(1);
  }
  return value;
}

function badIdentifier(value) {
  return !identifierPattern.test(value);
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  const failures = [];
  const schemas = await pool.query(
    `select schema_name from information_schema.schemata where schema_name = any($1::text[]) order by schema_name`,
    [domainSchemas],
  );
  for (const row of schemas.rows) {
    if (badIdentifier(row.schema_name)) failures.push(`schema ${row.schema_name}`);
  }

  const tables = await pool.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type in ('BASE TABLE', 'VIEW')
        and table_schema = any($1::text[])
      order by table_schema, table_name`,
    [['public', ...domainSchemas]],
  );
  for (const row of tables.rows) {
    const qualified = `${row.table_schema}.${row.table_name}`;
    if (badIdentifier(row.table_name)) failures.push(`table ${qualified}`);
    if (domainSchemas.includes(row.table_schema) && row.table_name.startsWith('ops_')) {
      failures.push(`legacy ops_ table ${qualified}`);
    }
    if (row.table_schema === 'public' && row.table_name !== '_prisma_migrations') {
      failures.push(`runtime table/view remains in public: ${qualified}`);
    }
  }

  const columns = await pool.query(
    `select table_schema, table_name, column_name
       from information_schema.columns
      where table_schema = any($1::text[])
      order by table_schema, table_name, ordinal_position`,
    [domainSchemas],
  );
  for (const row of columns.rows) {
    if (badIdentifier(row.column_name)) failures.push(`column ${row.table_schema}.${row.table_name}.${row.column_name}`);
  }

  const indexes = await pool.query(
    `select schemaname as schema_name, tablename as table_name, indexname as index_name
       from pg_indexes
      where schemaname = any($1::text[])
      order by schemaname, tablename, indexname`,
    [domainSchemas],
  );
  for (const row of indexes.rows) {
    const qualified = `${row.schema_name}.${row.index_name}`;
    if (badIdentifier(row.index_name)) failures.push(`index ${qualified}`);
    if (row.index_name.startsWith('ops_')) failures.push(`legacy ops_ index ${qualified}`);
  }

  const constraints = await pool.query(
    `select n.nspname as schema_name, t.relname as table_name, c.conname as constraint_name
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = any($1::text[])
      order by n.nspname, t.relname, c.conname`,
    [domainSchemas],
  );
  for (const row of constraints.rows) {
    const qualified = `${row.schema_name}.${row.table_name}.${row.constraint_name}`;
    if (badIdentifier(row.constraint_name)) failures.push(`constraint ${qualified}`);
    if (row.constraint_name.startsWith('ops_')) failures.push(`legacy ops_ constraint ${qualified}`);
  }

  if (failures.length > 0) {
    console.error('Naming audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Naming audit passed for domain schemas, tables, columns, indexes, and constraints.');
} finally {
  await pool.end();
}