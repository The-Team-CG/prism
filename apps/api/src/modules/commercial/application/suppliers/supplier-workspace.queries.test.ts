import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/kernel/database';
import { SupplierWorkspaceQueries } from './supplier-workspace.queries';

describe('SupplierWorkspaceQueries', () => {
  it('returns all-review aggregates and exact filtered totals without loading whole supplier histories', async () => {
    const rawRows = [{
      totalCount: 725,
      id: 'sup_701',
      name: 'Northstar Catering',
      categoryId: 'cat_food',
      categoryName: 'Catering',
      categorySlug: 'catering',
      tier: 'tier_1',
      bniMember: true,
      contactName: 'Mara',
      email: 'mara@example.test',
      phone: '+63 900 111 2222',
      averageRating: 4.3,
      reviewCount: 127,
      lastReviewedAt: new Date('2026-09-20T08:00:00.000Z'),
      rejected: 0,
      expired: 1,
      submitted: 0,
      verified: 2,
      unknown: 0,
      attention: 'expired',
    }];
    const queryRaw = vi.fn<(...args: unknown[]) => Promise<typeof rawRows>>(async () => rawRows);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const queries = new SupplierWorkspaceQueries(prisma);
    const query = {
      q: 'northstar', categoryId: undefined, tier: undefined, rating: '4.0',
      sort: 'rating', direction: 'desc', page: 28, pageSize: 25,
    } as const;

    const page = await queries.listDirectory(query, new Date('2026-10-07T12:00:00.000Z'));

    expect(page.totalCount).toBe(725);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      id: 'sup_701', rating: { average: 4.3, count: 127 },
      certifications: { expired: 1, attention: 'expired' },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as unknown as Prisma.Sql;
    expect(sql.sql).toContain('supplier_reviews');
    expect(sql.sql).toContain('supplier_certifications');
    expect(sql.sql.toLowerCase()).toContain('count(*)');
    expect(sql.sql).toContain('ORDER BY');
    expect(sql.sql).not.toContain('northstar');
    expect(sql.values).toContain('northstar');
  });

  it('uses a static sort whitelist and stable ID tie-break for every directory request', async () => {
    const queryRaw = vi.fn<(...args: unknown[]) => Promise<never[]>>(async () => []);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const queries = new SupplierWorkspaceQueries(prisma);

    await queries.listDirectory({
      q: '', categoryId: undefined, tier: undefined, rating: 'all',
      sort: 'certifications', direction: 'asc', page: 0, pageSize: 25,
    }, new Date('2026-10-07T12:00:00.000Z'));

    const sql = queryRaw.mock.calls[0]?.[0] as unknown as Prisma.Sql;
    expect(sql.sql).toContain('attention_rank');
    expect(sql.sql.toLowerCase()).toContain('filtered.id asc');
    expect(sql.sql).not.toContain('certifications ASC');
  });
});
