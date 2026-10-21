import process from 'node:process';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';
import { domainPersistenceCatalog, loadOwnershipManifest } from './domain-persistence-catalog.mjs';

const acceptedArguments = new Set(['--final']);
const unknownArguments = process.argv.slice(2).filter((argument) => !acceptedArguments.has(argument));
if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}. Supported option: --final.`);
  process.exit(1);
}

const final = process.argv.includes('--final');
const { schemas: domainSchemas } = domainPersistenceCatalog(loadOwnershipManifest(), { final });

const database = selectDatabaseConnection({ purpose: 'migration' });
const pool = new Pool({ connectionString: database.connectionString, ssl: database.ssl });

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
        and n.nspname = any($1::text[])
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
  `, [domainSchemas]);

  if (result.rows.length > 0) {
    console.error('Foreign keys missing supporting leading indexes:');
    for (const row of result.rows) console.error(`- ${row.schema_name}.${row.table_name}: ${row.conname}`);
    process.exit(1);
  }

  console.log('FK index audit passed.');
} finally {
  await pool.end();
}
