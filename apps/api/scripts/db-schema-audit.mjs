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
const catalog = domainPersistenceCatalog(loadOwnershipManifest(), { final });
const expectedTables = catalog.tables.map(({ schema, table }) => [schema, table]);
const domainSchemas = catalog.schemas;

const database = selectDatabaseConnection({ purpose: 'migration' });
const pool = new Pool({ connectionString: database.connectionString, ssl: database.ssl });

try {
  const schemaRows = await pool.query(
    `select schema_name
       from information_schema.schemata
      where schema_name = any($1::text[])
      order by schema_name`,
    [domainSchemas],
  );
  const presentSchemas = new Set(schemaRows.rows.map(({ schema_name }) => schema_name));
  const missingSchemas = domainSchemas.filter((schema) => !presentSchemas.has(schema));

  const existing = await pool.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema = any($1::text[])`,
    [domainSchemas],
  );
  const present = new Set(existing.rows.map((row) => `${row.table_schema}.${row.table_name}`));
  const missing = expectedTables.filter(([schema, table]) => !present.has(`${schema}.${table}`));
  const expected = new Set(expectedTables.map(([schema, table]) => `${schema}.${table}`));
  const unexpected = existing.rows.filter(({ table_schema, table_name }) =>
    !expected.has(`${table_schema}.${table_name}`));

  const publicTables = await pool.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name <> '_prisma_migrations'
      order by table_name`,
  );

  if (missingSchemas.length > 0 || missing.length > 0 || unexpected.length > 0 || publicTables.rows.length > 0) {
    if (missingSchemas.length > 0) {
      console.error('Missing expected domain schemas:');
      for (const schema of missingSchemas) console.error(`- ${schema}`);
    }
    if (missing.length > 0) {
      console.error('Missing expected domain tables:');
      for (const [schema, table] of missing) console.error(`- ${schema}.${table}`);
    }
    if (unexpected.length > 0) {
      console.error('Unowned base tables in domain schemas:');
      for (const row of unexpected) console.error(`- ${row.table_schema}.${row.table_name}`);
    }
    if (publicTables.rows.length > 0) {
      console.error('Runtime tables still in public:');
      for (const row of publicTables.rows) console.error(`- public.${row.table_name}`);
    }
    process.exit(1);
  }

  console.log(`Schema audit passed for ${expectedTables.length} ${final ? 'target' : 'current'} domain tables across ${domainSchemas.length} schemas.`);
} finally {
  await pool.end();
}
