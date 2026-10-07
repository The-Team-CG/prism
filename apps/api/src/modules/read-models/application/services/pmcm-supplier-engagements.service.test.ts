import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PmcmSupplierEngagementsService } from './pmcm-supplier-engagements.service';

const actor = { role: 'pmcm-admin', name: 'Maxine' };

describe('PmcmSupplierEngagementsService', () => {
  it('keeps event requests separate and derives review and promotion actions from recorded facts', async () => {
    const reader = {
      listEngagementFacts: vi.fn(async () => ({
        items: [
          {
            eventId: 'evt_completed', lastRequestAt: '2026-09-02T00:00:00.000Z', hasConfirmedAssignment: true, hasAssessment: true,
            requests: [
              { id: 'req_catering', category: 'Catering', status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'ready', eventDayStatus: 'completed' },
              { id: 'req_av', category: 'AV', status: 'selected', assignmentStatus: 'pending_confirmation', readinessStatus: 'not_requested', eventDayStatus: 'not_started' },
            ], requestCount: 2, hasMoreRequests: false,
          },
          {
            eventId: 'evt_archived', lastRequestAt: '2026-08-02T00:00:00.000Z', hasConfirmedAssignment: true, hasAssessment: false,
            requests: [{ id: 'req_archived', category: 'Catering', status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'pending', eventDayStatus: 'not_started' }],
            requestCount: 1, hasMoreRequests: false,
          },
          {
            eventId: 'evt_missing_end', lastRequestAt: '2026-07-02T00:00:00.000Z', hasConfirmedAssignment: true, hasAssessment: false,
            requests: [{ id: 'req_not_ended', category: 'Catering', status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'ready', eventDayStatus: 'not_started' }],
            requestCount: 1, hasMoreRequests: false,
          },
          {
            eventId: 'evt_unconfirmed', lastRequestAt: '2026-06-02T00:00:00.000Z', hasConfirmedAssignment: false, hasAssessment: true,
            requests: [{ id: 'req_unconfirmed', category: 'Catering', status: 'open', assignmentStatus: 'pending_confirmation', readinessStatus: 'not_requested', eventDayStatus: 'not_started' }],
            requestCount: 1, hasMoreRequests: false,
          },
        ],
        totalCount: 4, page: 0, pageSize: 25, hasNextPage: false, supplierTier: 'pending_first_event',
      })),
    };
    const queries = {
      forEvents: vi.fn(async () => [
        { id: 'evt_completed', eventName: 'Spring Summit', eventDate: new Date('2026-09-01'), status: 'completed', actualEndedAt: new Date('2026-09-01T12:00:00Z') },
        { id: 'evt_archived', eventName: 'Archived Gala', eventDate: new Date('2026-08-01'), status: 'archived', actualEndedAt: new Date('2026-08-01T12:00:00Z') },
        { id: 'evt_missing_end', eventName: 'Planning Retreat', eventDate: new Date('2026-07-01'), status: 'completed', actualEndedAt: null },
        { id: 'evt_unconfirmed', eventName: 'Future Expo', eventDate: new Date('2026-06-01'), status: 'completed', actualEndedAt: new Date('2026-06-01T12:00:00Z') },
      ]),
    };
    const policy = { requireActorRole: vi.fn(async () => undefined) };
    const service = new PmcmSupplierEngagementsService(reader as any, queries as any, policy as any);

    const result = await service.listEngagements('sup_1', { page: 0, pageSize: 25 }, actor as any);

    expect(result.totalCount).toBe(4);
    expect(result.items.map((item) => [item.event.id, item.canReview, item.canPromote])).toEqual([
      ['evt_completed', true, true],
      ['evt_archived', true, false],
      ['evt_missing_end', false, false],
      ['evt_unconfirmed', false, false],
    ]);
    expect(result.items[0]?.requests.map((request) => request.readinessStatus)).toEqual(['ready', 'not_requested']);
    expect(result.items[0]?.requests).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('supplierTier');
    expect(JSON.stringify(result)).not.toMatch(/accessToken|amount|clientEmail|auditMetadata|otherSupplier/i);
    expect(queries.forEvents).toHaveBeenCalledWith(['evt_completed', 'evt_archived', 'evt_missing_end', 'evt_unconfirmed']);
  });

  it('uses the current supplier tier when offering a promotion action', async () => {
    const reader = {
      listEngagementFacts: vi.fn(async () => ({
        items: [{ eventId: 'evt_1', lastRequestAt: '2026-09-02T00:00:00.000Z', hasConfirmedAssignment: true, hasAssessment: true, requests: [], requestCount: 0, hasMoreRequests: false }],
        totalCount: 1, page: 0, pageSize: 25, hasNextPage: false, supplierTier: 'tier_1',
      })),
    };
    const queries = { forEvents: vi.fn(async () => [{ id: 'evt_1', eventName: 'Summit', eventDate: new Date('2026-09-01'), status: 'completed', actualEndedAt: new Date('2026-09-01T12:00:00Z') }]) };
    const service = new PmcmSupplierEngagementsService(reader as any, queries as any, { requireActorRole: vi.fn(async () => undefined) } as any);

    const result = await service.listEngagements('sup_1', { page: 0, pageSize: 25 }, actor as any);

    expect(result.items[0]?.canReview).toBe(true);
    expect(result.items[0]?.canPromote).toBe(false);
  });

  it.each(['supplier', 'client', 'guest', 'coordinator', 'unknown'])('refuses %s before reading commercial supplier facts', async (role) => {
    const reader = { listEngagementFacts: vi.fn() };
    const queries = { forEvents: vi.fn() };
    const policy = { requireActorRole: vi.fn(async () => { throw new ForbiddenException(); }) };
    const service = new PmcmSupplierEngagementsService(reader as any, queries as any, policy as any);

    await expect(service.listEngagements('sup_1', { page: 0, pageSize: 25 }, { role } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reader.listEngagementFacts).not.toHaveBeenCalled();
    expect(queries.forEvents).not.toHaveBeenCalled();
  });
});
