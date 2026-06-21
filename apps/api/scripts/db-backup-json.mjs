import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const runtimeSchemas = [
  'public',
  'floorplan',
  'identity',
  'event_core',
  'supplier_ops',
  'staffing_ops',
  'finance_ops',
  'compliance_ops',
  'guest_ops',
  'trust_ops',
];

function connectionString() {
  const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL, process.env.PRISMA_DATABASE_URL, process.env.DIRECT_URL];
  const value = candidates.map((item) => item?.trim()).find(Boolean);
  if (!value) {
    console.error('No database URL configured. Set SUPABASE_DB_URL, DATABASE_URL, PRISMA_DATABASE_URL, or DIRECT_URL.');
    process.exit(1);
  }
  return value;
}

function backupDir() {
  const requested = process.env.PRISM_DB_BACKUP_DIR?.trim();
  if (requested) return requested;
  return path.resolve(process.cwd(), '..', '..', '.local-dev', 'db-backups');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  const tables = await pool.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema = any($1::text[])
      order by table_schema, table_name`,
    [runtimeSchemas],
  );

  const snapshot = {
    createdAt: new Date().toISOString(),
    source: 'prism db-backup-json',
    schemas: runtimeSchemas,
    tables: [],
  };

  for (const table of tables.rows) {
    const countResult = await pool.query(`select count(*)::bigint as count from "${table.table_schema}"."${table.table_name}"`);
    const rowsResult = await pool.query(`select * from "${table.table_schema}"."${table.table_name}"`);
    snapshot.tables.push({
      schema: table.table_schema,
      table: table.table_name,
      rowCount: Number(countResult.rows[0]?.count ?? 0),
      rows: rowsResult.rows,
    });
  }

  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `prism-db-backup-${timestamp()}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Backup written: ${file}`);
  console.log(`Tables exported: ${snapshot.tables.length}`);
  console.log(`Rows exported: ${snapshot.tables.reduce((sum, table) => sum + table.rowCount, 0)}`);
} finally {
  await pool.end();
}
