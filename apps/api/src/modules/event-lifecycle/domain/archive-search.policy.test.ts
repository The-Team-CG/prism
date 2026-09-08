import { describe, expect, it } from 'vitest';
import { archivedEventMatchesSearch } from './archive-search.policy';

const hit = { eventName: 'Annual Leadership Forum', clientName: 'Acme Holdings', venue: 'Shangri-La Grand Ballroom', eventType: 'Leadership Forum', eventDate: '2026-06-18' };

describe('archivedEventMatchesSearch', () => {
  it('matches venue, type, and month together', () => {
    expect(archivedEventMatchesSearch(hit, { venue: 'shangri', eventType: 'Leadership', month: '2026-06' })).toBe(true);
  });

  it('rejects a different month', () => {
    expect(archivedEventMatchesSearch(hit, { month: '2026-07' })).toBe(false);
  });

  it('searches existing event and client fields', () => {
    expect(archivedEventMatchesSearch(hit, { eventName: 'annual', clientName: 'acme' })).toBe(true);
    expect(archivedEventMatchesSearch(hit, { clientName: 'other' })).toBe(false);
  });
});
