import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIVACY_RETENTION_CATEGORIES } from '@prism/types';

const migration = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', 'prisma', 'migrations', '20261019120400_platform-ops_privacy_retention_review', 'migration.sql'),
  'utf8',
);

describe('privacy retention migration seed', () => {
  const seedRows = [...migration.matchAll(/^\s*\('([a-z_]+)', '[^']*', '[^']*', (\d+), '[a-z_]+', '[a-z_]+', (true|false), 1, 'migration'\)/gm)]
    .map((match) => ({ category: match[1], periodDays: Number(match[2]), enabled: match[3] === 'true' }));

  it('seeds every retention category exactly once, all disabled, so nothing runs until PMCM enables a policy', () => {
    expect(seedRows.map((row) => row.category).sort()).toEqual([...PRIVACY_RETENTION_CATEGORIES].sort());
    expect(seedRows.filter((row) => row.enabled)).toEqual([]);
  });

  it('uses the conservative defaults for guest, inquiry, and archive-retained records', () => {
    const periodFor = (category: string) => seedRows.find((row) => row.category === category)?.periodDays;
    expect(periodFor('inquiry')).toBe(730);
    expect(periodFor('guest_check_in')).toBe(730);
    expect(periodFor('guest_feedback')).toBe(730);
    expect(periodFor('audit')).toBe(2555);
  });

  it('creates no sweep or deletion statements, so the migration cannot change personal data', () => {
    expect(migration).not.toMatch(/^\s*(DELETE|UPDATE|TRUNCATE)\b/im);
  });
});
