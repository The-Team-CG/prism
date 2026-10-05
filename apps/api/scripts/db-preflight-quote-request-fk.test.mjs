import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoQuoteRequestOrphans, findQuoteRequestOrphans } from './db-preflight-quote-request-fk.mjs';

test('quote-request preflight passes when no quote rows are orphaned', async () => {
  const pool = {
    query: async () => ({ rows: [{ orphan_count: '0' }] }),
  };

  const result = await findQuoteRequestOrphans(pool);
  assert.deepEqual(result, { orphanCount: 0, sampleQuoteIds: [] });
  assert.doesNotThrow(() => assertNoQuoteRequestOrphans(result));
});

test('quote-request preflight fails closed with a bounded orphan sample', async () => {
  const calls = [];
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return calls.length === 1
        ? { rows: [{ orphan_count: '12' }] }
        : { rows: [{ id: 'quote-a' }, { id: 'quote-b' }] };
    },
  };

  const result = await findQuoteRequestOrphans(pool, { sampleLimit: 2 });
  assert.deepEqual(result, { orphanCount: 12, sampleQuoteIds: ['quote-a', 'quote-b'] });
  assert.deepEqual(calls[1].values, [2]);
  assert.throws(
    () => assertNoQuoteRequestOrphans(result),
    /12 orphan quote\(s\).*quote-a, quote-b/,
  );
});