import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { FloorplanSeatingFactsService } from './floorplan-seating.service';

describe('FloorplanSeatingFactsService', () => {
  it('offers only roster guests who are still invited and eligible, with their RSVP', async () => {
    const findMany = vi.fn(async () => [{ id: 'gre_ana', rsvp: 'declined', guestName: 'Ana Reyes' }]);
    const service = new FloorplanSeatingFactsService({ opsGuestRosterEntry: { findMany } } as unknown as PrismaService);

    await expect(service.listSeatingGuests('evt_1')).resolves.toEqual([{ id: 'gre_ana', rsvp: 'declined', name: 'Ana Reyes' }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'evt_1', withdrawnAt: null, eligibility: 'eligible' } }));
  });

  it('counts a supplier as booked only through a selected quote request', async () => {
    const findMany = vi.fn(async () => [{ supplierId: 'sup_1' }, { supplierId: 'sup_1' }]);
    const service = new FloorplanSeatingFactsService({ opsSupplierQuoteRequest: { findMany } } as unknown as PrismaService);

    await expect(service.bookedSupplierIds('evt_1')).resolves.toEqual(new Set(['sup_1']));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'evt_1', status: 'selected', supplierId: { not: null } } }));
  });
});
