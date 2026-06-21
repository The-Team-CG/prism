import process from 'node:process';
import { Pool } from 'pg';

const expectedTables = [
  ['floorplan', 'floor_plans'],
  ['floorplan', 'floor_plan_objects'],
  ['floorplan', 'venue_templates'],
  ['floorplan', 'event_instances'],
  ['floorplan', 'published_snapshots'],
  ['floorplan', 'floor_plan_drafts'],
  ['identity', 'users'],
  ['identity', 'approval_requests'],
  ['identity', 'login_history'],
  ['identity', 'security_alerts'],
  ['event_core', 'inquiries'],
  ['event_core', 'events'],
  ['event_core', 'privacy_requests'],
  ['event_core', 'documents'],
  ['event_core', 'briefings'],
  ['supplier_ops', 'supplier_categories'],
  ['supplier_ops', 'suppliers'],
  ['supplier_ops', 'supplier_reviews'],
  ['supplier_ops', 'supplier_reliability_notes'],
  ['supplier_ops', 'supplier_certifications'],
  ['supplier_ops', 'quote_requests'],
  ['supplier_ops', 'quotes'],
  ['staffing_ops', 'coordinators'],
  ['staffing_ops', 'coordinator_assignments'],
  ['staffing_ops', 'event_day_tasks'],
  ['staffing_ops', 'urgent_issues'],
  ['staffing_ops', 'event_day_logs'],
  ['staffing_ops', 'coordinator_reliability_notes'],
  ['finance_ops', 'billing_sources'],
  ['finance_ops', 'billing_statements'],
  ['finance_ops', 'payment_milestones'],
  ['finance_ops', 'payment_records'],
  ['compliance_ops', 'compliance_rules'],
  ['compliance_ops', 'compliance_checks'],
  ['compliance_ops', 'post_event_documents'],
  ['compliance_ops', 'event_insights'],
  ['guest_ops', 'check_ins'],
  ['guest_ops', 'feedback'],
  ['trust_ops', 'audit_logs'],
  ['trust_ops', 'notification_logs'],
  ['trust_ops', 'ai_audit_logs'],
  ['trust_ops', 'ai_approval_records'],
];

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
  const existing = await pool.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema = any($1::text[])`,
    [[...new Set(expectedTables.map(([schema]) => schema))]],
  );
  const present = new Set(existing.rows.map((row) => `${row.table_schema}.${row.table_name}`));
  const missing = expectedTables.filter(([schema, table]) => !present.has(`${schema}.${table}`));

  const publicTables = await pool.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name <> '_prisma_migrations'
      order by table_name`,
  );

  if (missing.length > 0 || publicTables.rows.length > 0) {
    if (missing.length > 0) {
      console.error('Missing expected domain tables:');
      for (const [schema, table] of missing) console.error(`- ${schema}.${table}`);
    }
    if (publicTables.rows.length > 0) {
      console.error('Runtime tables still in public:');
      for (const row of publicTables.rows) console.error(`- public.${row.table_name}`);
    }
    process.exit(1);
  }

  console.log(`Schema audit passed for ${expectedTables.length} domain tables.`);
} finally {
  await pool.end();
}