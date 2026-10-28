import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  domainPersistenceCatalog,
  loadOwnershipManifest,
  ownerTableReference,
  renderOwnerTableReferences,
} from './domain-persistence-catalog.mjs';

describe('domain persistence catalog', () => {
  it('selects all registered tables in their current and target schemas', () => {
    const manifest = loadOwnershipManifest();
    const current = domainPersistenceCatalog(manifest);
    const target = domainPersistenceCatalog(manifest, { final: true });

    assert.equal(current.tables.length, 95);
    assert.equal(current.schemas.length, 10);
    assert.equal(target.tables.length, 132);
    assert.equal(target.tables.find(({ table }) => table === 'account_invitations').schema, 'identity_access');
    assert.equal(target.tables.find(({ table }) => table === 'inquiry_merges').schema, 'event_lifecycle');
    assert.equal(current.tables.some(({ table }) => table === 'client_floorplan_access_grants'), false);
    assert.equal(target.tables.find(({ table }) => table === 'client_floorplan_access_grants').schema, 'event_lifecycle');
    assert.equal(target.tables.find(({ table }) => table === 'supplier_payout_records').schema, 'commercial');
    assert.equal(target.tables.find(({ table }) => table === 'conforme_executions').schema, 'event_lifecycle');
    assert.equal(target.tables.find(({ table }) => table === 'client_decisions').schema, 'floorplan');
    assert.equal(target.tables.find(({ table }) => table === 'floor_plan_snapshot_versions').schema, 'floorplan');
    assert.equal(target.tables.find(({ table }) => table === 'file_requirement_templates').schema, 'event_lifecycle');
    assert.equal(current.tables.find(({ table }) => table === 'privacy_legal_holds').schema, 'platform_ops');
    assert.equal(target.tables.find(({ table }) => table === 'privacy_legal_holds').schema, 'platform_ops');
    assert.equal(target.schemas.length, 8);
    assert.equal(current.tables.find(({ table }) => table === 'quotes').schema, 'supplier_ops');
    assert.equal(target.tables.find(({ table }) => table === 'quotes').schema, 'commercial');
  });

  it('resolves exact owner table tokens for current and final schemas', () => {
    const manifest = loadOwnershipManifest();
    const query = 'SELECT id FROM {{commercial.quotes}}';
    assert.equal(
      renderOwnerTableReferences(query, manifest),
      'SELECT id FROM "supplier_ops"."quotes"',
    );
    assert.equal(
      renderOwnerTableReferences(query, manifest, { final: true }),
      'SELECT id FROM "commercial"."quotes"',
    );
    assert.equal(ownerTableReference(manifest, 'commercial', 'quotes').model, 'OpsSupplierQuote');
  });

  it('fails closed for unmapped or duplicate owner table tokens', () => {
    assert.throws(
      () => renderOwnerTableReferences('SELECT * FROM {{commercial.unknown}}', { ownership: [] }),
      /map commercial\.unknown exactly once/,
    );
    assert.throws(
      () => ownerTableReference({
        ownership: [
          { domain: 'commercial', table: 'quotes', currentSchema: 'one', targetSchema: 'commercial' },
          { domain: 'commercial', table: 'quotes', currentSchema: 'two', targetSchema: 'commercial' },
        ],
      }, 'commercial', 'quotes'),
      /map commercial\.quotes exactly once/,
    );
  });

  it('rejects duplicate schema/table ownership instead of silently dropping a row', () => {
    const manifest = {
      ownership: [
        { model: 'First', currentSchema: 'legacy', targetSchema: 'commercial', table: 'quotes', domain: 'commercial' },
        { model: 'Second', currentSchema: 'legacy', targetSchema: 'commercial', table: 'quotes', domain: 'commercial' },
      ],
    };

    assert.throws(() => domainPersistenceCatalog(manifest), /assigns legacy\.quotes more than once/);
    assert.throws(() => domainPersistenceCatalog(manifest, { final: true }), /assigns commercial\.quotes more than once/);
  });

  it('rejects missing ownership rows', () => {
    assert.throws(() => domainPersistenceCatalog({ ownership: [] }), /must contain ownership rows/);
  });

  it('registers each event-games table under its dedicated owner schema', () => {
    const manifest = loadOwnershipManifest();
    const expectedTables = [
      'active_pin_reservations',
      'awards',
      'game_config_versions',
      'game_definitions',
      'game_sessions',
      'lobby_slugs',
      'moderation_actions',
      'participant_credentials',
      'pin_history',
      'rate_limit_buckets',
      'score_ledger',
      'session_participation_grants',
      'submissions',
    ];
    const rows = manifest.ownership.filter(({ domain }) => domain === 'event-games');

    assert.deepEqual(rows.map(({ table }) => table).sort(), expectedTables);
    assert.ok(rows.every(({ currentSchema, targetSchema, introducedAfterCutover }) => (
      currentSchema === 'event_games'
      && targetSchema === 'event_games'
      && introducedAfterCutover === true
    )));

    const catalog = domainPersistenceCatalog(manifest, { final: true });
    assert.deepEqual(
      catalog.tables.filter(({ domain }) => domain === 'event-games').map(({ schema, table }) => ({ schema, table })).sort((a, b) => a.table.localeCompare(b.table)),
      expectedTables.map((table) => ({ schema: 'event_games', table })),
    );
    assert.ok(catalog.schemas.includes('event_games'));
  });
});
