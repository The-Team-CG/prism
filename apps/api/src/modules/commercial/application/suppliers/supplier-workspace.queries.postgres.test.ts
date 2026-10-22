import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PmcmSupplierDirectoryQuery } from '@prism/types';
import { SupplierWorkspaceQueries } from './supplier-workspace.queries';

const url = process.env.P0_TEST_DATABASE_URL?.trim();
const validTarget = Boolean(url && (() => {
  const parsed = new URL(url);
  return parsed.hostname === '127.0.0.1' && parsed.port === '55437' && parsed.pathname === '/prism_p0';
})());
if (url && !validTarget) throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');

const prefix = `p0_sw_${randomUUID().replaceAll('-', '')}`;
const categoryId = `${prefix}_category`;
const supplierIds = Array.from({ length: 507 }, (_, index) => `${prefix}_supplier_${String(index).padStart(3, '0')}`);
const expiresYesterday = new Date('2026-10-05T16:00:00.000Z');
const expiresToday = new Date('2026-10-06T16:00:00.000Z');
const asOf = new Date('2026-10-07T12:00:00.000Z');

describe.skipIf(!validTarget)('SupplierWorkspaceQueries PostgreSQL behavior', () => {
  let prisma: PrismaService;
  let queries: SupplierWorkspaceQueries;

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = url;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    queries = new SupplierWorkspaceQueries(prisma);
    await prisma.opsSupplierCategory.create({ data: { id: categoryId, slug: categoryId, name: 'P0 Workspace Food' } });
    await prisma.opsSupplier.createMany({ data: supplierIds.map((id) => ({
      id, categoryId, name: 'Equal Name Supplier', tier: 'tier_1', contactName: 'Test Contact', email: `${id}@example.test`,
    })) });
    await prisma.opsSupplierReview.createMany({ data: Array.from({ length: 127 }, (_, index) => ({
      id: `${prefix}_review_${String(index).padStart(3, '0')}`,
      supplierId: supplierIds[506],
      rating: index < 88 ? 4 : 5,
      notes: `review ${index}`,
      reviewedBy: 'P0 Reviewer',
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
    })) });
    await prisma.opsSupplierCertification.createMany({ data: [
      { id: `${prefix}_cert_expired`, supplierId: supplierIds[506], fileName: 'expired.pdf', documentType: 'permit', status: 'verified', expiresAt: expiresYesterday },
      { id: `${prefix}_cert_today`, supplierId: supplierIds[506], fileName: 'today.pdf', documentType: 'permit', status: 'verified', expiresAt: expiresToday },
      { id: `${prefix}_cert_submitted`, supplierId: supplierIds[506], fileName: 'submitted.pdf', documentType: 'permit', status: 'submitted' },
      { id: `${prefix}_cert_rejected`, supplierId: supplierIds[506], fileName: 'rejected.pdf', documentType: 'permit', status: 'rejected' },
      { id: `${prefix}_cert_unknown`, supplierId: supplierIds[506], fileName: 'unknown.pdf', documentType: 'permit', status: 'awaiting_review' },
    ] });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.opsSupplier.deleteMany({ where: { id: { startsWith: `${prefix}_supplier_` } } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  });

  it('pages past 500 suppliers, applies rating filters globally, aggregates all reviews, and sorts ties by ID', async () => {
    const baseQuery: PmcmSupplierDirectoryQuery = {
      q: '', categoryId, tier: undefined, rating: 'all', sort: 'name', direction: 'asc', page: 20, pageSize: 25,
    };
    const page = await queries.listDirectory(baseQuery, asOf);

    expect(page.totalCount).toBe(507);
    expect(page.rows).toHaveLength(7);
    expect(page.rows.map((row) => row.id)).toEqual([...page.rows.map((row) => row.id)].sort());
    const lastRow = page.rows[page.rows.length - 1];
    expect(lastRow?.id).toBe(supplierIds[506]);
    expect(lastRow?.rating).toMatchObject({ count: 127, average: 4.3 });

    const rated = await queries.listDirectory({ ...baseQuery, rating: '4.0', page: 0 }, asOf);
    expect(rated.totalCount).toBe(1);
    expect(rated.rows[0]?.id).toBe(supplierIds[506]);
  });

  it('classifies expiry dates by the Manila calendar day and preserves unknown statuses', async () => {
    const query: PmcmSupplierDirectoryQuery = {
      q: supplierIds[506], categoryId, tier: undefined, rating: 'all', sort: 'name', direction: 'asc', page: 0, pageSize: 25,
    };
    const result = await queries.listDirectory(query, asOf);

    expect(result.rows[0]?.certifications).toEqual({
      rejected: 1, expired: 1, submitted: 1, verified: 1, unknown: 1, attention: 'rejected',
    });
  });
});
