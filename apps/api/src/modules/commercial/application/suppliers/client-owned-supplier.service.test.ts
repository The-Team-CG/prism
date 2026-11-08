import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ClientOwnedSupplierService } from './client-owned-supplier.service';
import { unresponsiveSuppliersFrom } from './unresponsive-supplier.service';

const client = { id: 'usr_client', role: OpsUserRole.Client, name: 'Ana', email: 'ana@test', explicit: true, verified: true };
const otherContact = { ...client, id: 'usr_other', email: 'other@test' };
const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };

function fixture() {
  const rows: Array<Record<string, unknown> & { id: string }> = [];
  const prisma = { opsClientOwnedSupplier: {
    findMany: vi.fn(async () => rows),
    findFirst: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> & { id: string } }) => { const row = { status: 'pending', confirmedAt: null, riskWarning: null, riskRaisedBy: null, createdAt: new Date(), ...data }; rows.push(row); return row; }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data)),
  } };
  const access = {
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const events = { findEventReadAccess: vi.fn(async () => ({ id: 'evt_1', clientPortalStatus: 'unlocked', inquiry: { email: 'ana@test' } })) };
  return new ClientOwnedSupplierService(prisma as never, access as never, { write: vi.fn(async () => undefined) } as never, events as never);
}

describe('FR-65 client-owned suppliers', () => {
  it('lets the primary client add and confirm its own supplier, and only PMCM raise a risk warning', async () => {
    const service = fixture();
    const added = await service.create('evt_1', { category: 'Photo', supplierName: 'Cousin Lens', contact: '0917', operationalNotes: 'Arrives 2pm' }, client);
    await expect(service.create('evt_1', { category: 'Band', supplierName: 'X' }, otherContact)).rejects.toThrow(ForbiddenException);
    expect(await service.confirm('evt_1', added.id, client)).toMatchObject({ status: 'confirmed', confirmedAt: expect.any(String) });
    await expect(service.raiseRisk('evt_1', added.id, { warning: 'No insurance' }, client)).rejects.toThrow(ForbiddenException);
    expect(await service.raiseRisk('evt_1', added.id, { warning: 'No ingress pass yet' }, pmcm)).toMatchObject({ riskWarning: 'No ingress pass yet', riskRaisedBy: 'Maxine' });
  });
});

describe('FR-76 unresponsive suppliers', () => {
  it('flags an open request after one window and suggests Tier 2 only after the second', () => {
    const sent = (hoursAgo: number, id: string) => ({ id, supplierId: `sup_${id}`, supplierName: `Supplier ${id}`, category: 'AV', categoryId: 'cat_av', createdAt: new Date(Date.parse('2026-11-10T00:00:00.000Z') - hoursAgo * 3_600_000) });
    const result = unresponsiveSuppliersFrom({
      eventName: 'Gala', now: new Date('2026-11-10T00:00:00.000Z'),
      requests: [sent(10, 'fresh'), sent(50, 'first'), sent(100, 'second')],
      phones: new Map([['sup_first', '09171234567']]),
      tier2ByCategory: new Map([['cat_av', [{ supplierId: 'sup_backup', supplierName: 'Backup AV' }]]]),
    });
    expect(result.map((item) => [item.requestId, item.window, item.tier2Suggestions.length])).toEqual([['first', 'first', 0], ['second', 'second', 1]]);
    expect(result[0]).toMatchObject({ supplierPhone: '09171234567', draftMessage: expect.stringContaining('AV quote request for Gala') });
  });
});
