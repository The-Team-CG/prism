import assert from 'node:assert/strict';
import test from 'node:test';
import { findMutatedMigrations } from './check-migration-immutability.mjs';

const dir = 'apps/api/prisma/migrations/20261028161600_floorplan_snapshot_round_history';
const file = `${dir}/migration.sql`;
const blobs = (map) => (path) => (path in map ? map[path] : null);

test('a migration that already exists on the base branch cannot change', () => {
  const violations = findMutatedMigrations({
    changes: [{ status: 'M', path: file }, { status: 'D', path: `${dir}/extra.sql` }],
    readBase: blobs({ [file]: 'ALTER TABLE a;\n' }),
    readHead: blobs({ [file]: 'ALTER TABLE b;\n' }),
  });
  assert.deepEqual(violations.map((v) => v.change), ['edited', 'deleted']);
  assert.equal(violations[0].migration, '20261028161600_floorplan_snapshot_round_history');
});

test('new migrations, other files and line-ending-only edits are fine', () => {
  const violations = findMutatedMigrations({
    changes: [
      { status: 'A', path: 'apps/api/prisma/migrations/20261101000000_commercial_new_thing/migration.sql' },
      { status: 'M', path: 'apps/api/prisma/migrations/migration_lock.toml' },
      { status: 'M', path: 'apps/api/src/app.module.ts' },
      { status: 'M', path: file },
    ],
    readBase: blobs({ [file]: 'ALTER TABLE a;\nSELECT 1;\n' }),
    readHead: blobs({ [file]: 'ALTER TABLE a;\r\nSELECT 1;\r\n' }),
  });
  assert.deepEqual(violations, []);
});

test('a listed exception passes, and an exception without a reason is not accepted by the loader', () => {
  const violations = findMutatedMigrations({
    changes: [{ status: 'M', path: file }],
    readBase: blobs({ [file]: 'a' }),
    readHead: blobs({ [file]: 'b' }),
    exceptions: [{ migration: '20261028161600_floorplan_snapshot_round_history', reason: 'Never applied outside CI' }],
  });
  assert.deepEqual(violations, []);
});
