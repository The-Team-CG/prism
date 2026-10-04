import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  domainPersistenceCatalog,
  loadOwnershipManifest,
} from './domain-persistence-catalog.mjs';

describe('domain persistence catalog', () => {
  it('selects all registered tables in their current and target schemas', () => {
    const manifest = loadOwnershipManifest();
    const current = domainPersistenceCatalog(manifest);
    const target = domainPersistenceCatalog(manifest, { final: true });

    assert.equal(current.tables.length, 91);
    assert.equal(current.schemas.length, 10);
    assert.equal(target.tables.length, 91);
    assert.equal(target.schemas.length, 7);
    assert.equal(current.tables.find(({ table }) => table === 'quotes').schema, 'supplier_ops');
    assert.equal(target.tables.find(({ table }) => table === 'quotes').schema, 'commercial');
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
});
