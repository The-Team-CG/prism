import { describe, expect, it } from 'vitest';
import { compareSnapshots } from './change-management.service';

describe('W26 deterministic snapshot comparison', () => {
  it('sorts keys and ignores object property order', () => {
    expect(compareSnapshots([{ id: 'quote-1', amount: 100, note: 'same' }], [{ note: 'same', amount: 125, id: 'quote-1' }])).toEqual([
      { key: 'quote-1', before: { id: 'quote-1', amount: 100, note: 'same' }, after: { note: 'same', amount: 125, id: 'quote-1' } },
    ]);
  });

  it('records additions and removals in deterministic key order', () => {
    expect(compareSnapshots([{ id: 'b', amount: 20 }, { id: 'a', amount: 10 }], [{ id: 'c', amount: 30 }])).toEqual([
      { key: 'a', before: { id: 'a', amount: 10 }, after: null },
      { key: 'b', before: { id: 'b', amount: 20 }, after: null },
      { key: 'c', before: null, after: { id: 'c', amount: 30 } },
    ]);
  });
});
