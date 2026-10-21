import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { listPrivacyRequestsQuerySchema } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PrivacyRequestQueueService, privacyRequestQueueWhere } from './privacy-request-queue.service';
import { isPrivacyRequestOverdue, mapPrivacyRequest, privacyRequestDueAt } from './privacy-request.mapper';

const NOW = new Date('2026-10-19T08:00:00.000Z');
const pmcmActor = { id: 'usr_maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test', name: 'Maxine', explicit: true, verified: true };

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'priv_1', eventId: 'evt_sample', subjectType: 'guest', subjectEmail: '', subjectName: 'Ana Reyes',
    requestType: 'deletion', status: 'submitted', requestNotes: '', reviewReason: '', executionNotes: '',
    createdBy: 'Maxine', reviewedBy: null, reviewedAt: null, executedBy: null, executedAt: null,
    dueAt: new Date('2026-10-18T08:00:00.000Z'), assignedTo: null as string | null,
    createdAt: new Date('2026-09-18T08:00:00.000Z'), updatedAt: new Date('2026-09-18T08:00:00.000Z'),
    ...overrides,
  };
}

function queueFixture(rows = [record()], total = rows.length) {
  const stored = record();
  const prisma = {
    opsPrivacyRequest: {
      count: vi.fn(async (_args: unknown) => total),
      findMany: vi.fn(async (_args: unknown) => rows),
      findUnique: vi.fn(async () => stored),
      findUniqueOrThrow: vi.fn(async () => stored),
      updateMany: vi.fn(async ({ data }: { data: { assignedTo: string | null } }) => {
        Object.assign(stored, data);
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (input: unknown) =>
      Array.isArray(input) ? Promise.all(input) : (input as (tx: unknown) => Promise<unknown>)(prisma)),
  };
  const auditService = { audit: vi.fn(async () => undefined) };
  const platformReferences = {
    findApprovedPmcmOperator: vi.fn(async (id: string): Promise<{ id: string; name: string } | null> =>
      id === 'usr_francis' ? { id, name: 'Francis' } : null),
  };
  const service = new PrivacyRequestQueueService(prisma as never, auditService as never, platformReferences as never);
  return { service, prisma, auditService, platformReferences, stored };
}

describe('privacy request SLA', () => {
  it('is due 30 days after submission and is overdue only while open and past due', () => {
    expect(privacyRequestDueAt(new Date('2026-09-18T08:00:00.000Z')).toISOString()).toBe('2026-10-18T08:00:00.000Z');

    const pastDue = new Date('2026-10-18T07:59:59.999Z');
    expect(isPrivacyRequestOverdue({ status: 'submitted', dueAt: pastDue }, NOW)).toBe(true);
    expect(isPrivacyRequestOverdue({ status: 'approved', dueAt: pastDue }, NOW)).toBe(true);
    expect(isPrivacyRequestOverdue({ status: 'executed', dueAt: pastDue }, NOW)).toBe(false);
    expect(isPrivacyRequestOverdue({ status: 'rejected', dueAt: pastDue }, NOW)).toBe(false);
    expect(isPrivacyRequestOverdue({ status: 'submitted', dueAt: NOW }, NOW)).toBe(false);
    expect(mapPrivacyRequest(record({ assignedTo: 'usr_francis' }), NOW)).toMatchObject({
      dueAt: '2026-10-18T08:00:00.000Z', overdue: true, assignedTo: 'usr_francis',
    });
  });
});

describe('PrivacyRequestQueueService', () => {
  const query = (input: Record<string, string> = {}) => listPrivacyRequestsQuerySchema.parse(input);

  it('combines status, type, subject, assignee, and overdue filters against one clock', () => {
    expect(privacyRequestQueueWhere(query(), NOW)).toEqual({});
    expect(privacyRequestQueueWhere(query({
      eventId: 'evt_sample', status: 'open', requestType: 'correction', subjectType: 'guest', assignedTo: 'unassigned', overdue: 'true',
    }), NOW)).toEqual({
      AND: [
        { eventId: 'evt_sample' },
        { status: { in: ['submitted', 'approved'] } },
        { requestType: 'correction' },
        { subjectType: 'guest' },
        { assignedTo: null },
        { status: { in: ['submitted', 'approved'] }, dueAt: { lt: NOW } },
      ],
    });
    expect(privacyRequestQueueWhere(query({ status: 'executed', assignedTo: 'usr_francis', overdue: 'false' }), NOW)).toEqual({
      AND: [
        { status: 'executed' },
        { assignedTo: 'usr_francis' },
        { OR: [{ status: { notIn: ['submitted', 'approved'] } }, { dueAt: { gte: NOW } }] },
      ],
    });
  });

  it('returns one bounded page ordered by deadline with totals and the overdue flag', async () => {
    const { service, prisma } = queueFixture([record(), record({ id: 'priv_2', status: 'executed' })], 7);
    const page = await service.listRequests(query({ page: '1', limit: '2' }), NOW);

    expect(prisma.opsPrivacyRequest.findMany).toHaveBeenCalledWith({
      where: {}, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], skip: 2, take: 2,
    });
    expect(page).toMatchObject({ page: 1, limit: 2, total: 7, hasMore: true });
    expect(page.items.map(({ id, overdue }) => [id, overdue])).toEqual([['priv_1', true], ['priv_2', false]]);
  });

  it('assigns an approved PMCM operator and audits only ids', async () => {
    const { service, prisma, auditService } = queueFixture();
    const result = await service.assignRequest('priv_1', { assignedTo: 'usr_francis' }, pmcmActor);

    expect(result.assignedTo).toBe('usr_francis');
    expect(prisma.opsPrivacyRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'priv_1', status: 'submitted', assignedTo: null }, data: { assignedTo: 'usr_francis' },
    });
    expect(auditService.audit).toHaveBeenCalledWith('evt_sample', 'Maxine', 'Assigned privacy request', expect.objectContaining({
      affectedType: 'privacy_request',
      metadata: { actorId: 'usr_maxine', requestId: 'priv_1', previousAssignee: null, assignedTo: 'usr_francis' },
    }), expect.objectContaining({ prisma, correlationId: 'privacy:priv_1:assignment' }));
    expect(JSON.stringify(auditService.audit.mock.calls)).not.toContain('Ana Reyes');

    await service.assignRequest('priv_1', { assignedTo: null }, pmcmActor);
    expect(auditService.audit).toHaveBeenLastCalledWith('evt_sample', 'Maxine', 'Unassigned privacy request', expect.objectContaining({
      metadata: expect.objectContaining({ previousAssignee: 'usr_francis', assignedTo: null }),
    }), expect.anything());
  });

  it('refuses system, unverified, or non-PMCM actors and non-operator or closed-request assignments without writing', async () => {
    const { service, prisma, auditService, stored } = queueFixture();

    await expect(service.assignRequest('priv_1', { assignedTo: 'usr_francis' }, { ...pmcmActor, role: OpsUserRole.System }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assignRequest('priv_1', { assignedTo: 'usr_francis' }, { ...pmcmActor, verified: false }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assignRequest('priv_1', { assignedTo: 'usr_francis' }, { ...pmcmActor, role: OpsUserRole.Coordinator }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assignRequest('priv_1', { assignedTo: 'usr_coordinator' }, pmcmActor))
      .rejects.toThrow('approved PMCM operator');
    stored.status = 'executed';
    await expect(service.assignRequest('priv_1', { assignedTo: 'usr_francis' }, pmcmActor))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.opsPrivacyRequest.updateMany).not.toHaveBeenCalled();
    expect(auditService.audit).not.toHaveBeenCalled();
  });
});
