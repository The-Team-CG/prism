// One-off conversion of legacy floor plans into Pascal scenes, run before the drop-legacy-columns migration:
//   npm --workspace prism-api run db:convert:floorplans -- --dry-run
//   npm --workspace prism-api run db:convert:floorplans
//
// Idempotent: a plan, snapshot or draft column that already has a scene is skipped, so a re-run writes nothing new.
// The rules live in floorplan-conversion.mjs. Each unit (a floor plan) commits in its own transaction.

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';
import { applyFloorplanConversion, formatReport, planFloorplanConversion } from './floorplan-conversion.mjs';

function parseArguments(argv) {
  const unknown = argv.filter((arg) => arg !== '--dry-run');
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}. Usage: convert-floorplans.mjs [--dry-run]`);
  return { dryRun: argv.includes('--dry-run') };
}

/** Reads every row the conversion needs, each query on its own pooled connection. */
async function loadRows(pool) {
  const [plans, objectRows, drafts, versions, templates, roster, annotations, decisions] = await Promise.all([
    pool.query('select id, name, width, height, objects, guests, scene from floorplan.floor_plans'),
    pool.query('select floor_plan_id, object_id, z_index, object_data from floorplan.floor_plan_objects'),
    pool.query('select id, event_id, floor_plan_id, source_type, submitted_snapshot, approved_snapshot from floorplan.floor_plan_drafts'),
    pool.query('select id, draft_id, snapshot from floorplan.floor_plan_snapshot_versions'),
    pool.query('select floor_plan_id from floorplan.venue_templates'),
    pool.query(
      `select id, event_id, guest_name from operations.guest_roster_entries
        where eligibility = 'eligible' and withdrawn_at is null and rsvp <> 'declined'`,
    ),
    pool.query('select id, draft_id, snapshot_hash, object_id from floorplan.client_annotations'),
    pool.query('select id, event_id, draft_id, snapshot_hash, action, comment from floorplan.client_decisions'),
  ]);

  const rowsByPlan = new Map();
  for (const row of objectRows.rows) {
    rowsByPlan.set(row.floor_plan_id, [...(rowsByPlan.get(row.floor_plan_id) ?? []), { objectId: row.object_id, zIndex: row.z_index, objectData: row.object_data }]);
  }
  const rosterByEvent = new Map();
  for (const entry of roster.rows) {
    rosterByEvent.set(entry.event_id, [...(rosterByEvent.get(entry.event_id) ?? []), { id: entry.id, name: entry.guest_name }]);
  }
  return {
    plans: plans.rows.map((row) => ({ id: row.id, name: row.name, width: row.width, height: row.height, objects: row.objects, guests: row.guests, scene: row.scene, objectRows: rowsByPlan.get(row.id) ?? [] })),
    drafts: drafts.rows.map((row) => ({ id: row.id, eventId: row.event_id, floorPlanId: row.floor_plan_id, sourceType: row.source_type, submittedSnapshot: row.submitted_snapshot, approvedSnapshot: row.approved_snapshot })),
    versions: versions.rows.map((row) => ({ id: row.id, draftId: row.draft_id, snapshot: row.snapshot })),
    templatePlanIds: new Set(templates.rows.map((row) => row.floor_plan_id)),
    roster: rosterByEvent,
    annotations: annotations.rows.map((row) => ({ id: row.id, draftId: row.draft_id, snapshotHash: row.snapshot_hash, objectId: row.object_id })),
    decisions: decisions.rows.map((row) => ({ id: row.id, eventId: row.event_id, draftId: row.draft_id, snapshotHash: row.snapshot_hash, action: row.action, comment: row.comment })),
  };
}

export async function convertFloorplans({ dryRun, connectionString, ssl }) {
  const pool = new Pool({ connectionString, ssl });
  try {
    const client = await pool.connect();
    try {
      const data = await loadRows(pool);
      const { statements, report } = planFloorplanConversion(data);
      console.log(formatReport(report, { dryRun }));
      if (dryRun) {
        if (report.skipped.length > 0) process.exitCode = 1;
        return report;
      }
      const committed = await applyFloorplanConversion(client, statements);
      console.log(`Committed ${committed} transaction(s).`);
      // The rest is written; a skipped row still needs fixing before the legacy columns can be dropped.
      if (report.skipped.length > 0) process.exitCode = 1;
      return report;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
// run-with-env.mjs imports this file with a relative argv[1], so resolve before comparing.
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const { dryRun } = parseArguments(process.argv.slice(2));
    const database = selectDatabaseConnection({ purpose: 'runtime' });
    await convertFloorplans({ dryRun, connectionString: database.connectionString, ssl: database.ssl });
  } catch (error) {
    console.error(`Floorplan conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
