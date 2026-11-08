import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { buildCoordinatorReplacementPackage } from './coordinator-replacement-package';
import { CoordinatorReplacementRecommendationService } from './coordinator-replacement-recommendation.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const coordinatorActor = { ...pmcm, id: 'usr_coord', role: OpsUserRole.Coordinator };
const suggestion = (id: string, name: string) => ({ id, name, role: 'Floor Director', matchedSkills: ['stage'], missingSkills: [], matchedSkillCount: 1, requiredSkillCount: 1 });

describe('FR-AI-04 PARE coordinator mode', () => {
  it('rates the package by time left and coverage, and drafts the message to the first pick', () => {
    const base = { role: 'Floor Director', withdrawnCoordinatorName: 'Marco', eventName: 'Gala', eventDate: new Date('2026-06-19T00:00:00.000Z') };
    const roomy = buildCoordinatorReplacementPackage({ ...base, now: new Date('2026-06-17T12:00:00.000Z'), suggestions: [suggestion('c1', 'Ana')] });
    expect(roomy).toMatchObject({ hoursToEvent: 36, riskLevel: 'high' });
    expect(roomy.draftMessage).toContain('Hi Ana, PMCM needs a Floor Director for Gala on 2026-06-19');
    expect(buildCoordinatorReplacementPackage({ ...base, now: new Date('2026-06-18T06:00:00.000Z'), suggestions: [suggestion('c1', 'Ana')] }).riskLevel).toBe('critical');
    expect(buildCoordinatorReplacementPackage({ ...base, now: new Date('2026-06-17T12:00:00.000Z'), suggestions: [] })).toMatchObject({ riskLevel: 'critical', candidates: [] });
  });

  it('assigns only a recommended coordinator on PMCM approval, once, and never for other roles', async () => {
    const row = {
      id: 'pkg_1', eventId: 'evt_1', withdrawnAssignmentId: 'asg_1', withdrawnCoordinatorName: 'Marco', role: 'Floor Director', hoursToEvent: 30,
      riskLevel: 'high', riskSummary: '', candidates: [{ coordinatorId: 'c1', name: 'Ana', matchedSkills: [], missingSkills: [] }], draftMessage: 'Hi Ana',
      status: 'pending', selectedCoordinatorId: null, reviewedBy: null, reviewedAt: null, createdAt: new Date(),
    };
    const prisma = { opsCoordinatorReplacementRecommendation: {
      findFirst: vi.fn(async () => row),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(row, data)),
    } };
    const access = { requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }) };
    const commands = { replaceCoordinator: vi.fn(async () => ({})) };
    const service = new CoordinatorReplacementRecommendationService(prisma as never, access as never, commands as never, { write: vi.fn(async () => undefined) } as never);

    await expect(service.decide('evt_1', 'pkg_1', { action: 'approve', coordinatorId: 'c1' }, coordinatorActor)).rejects.toThrow(ForbiddenException);
    await expect(service.decide('evt_1', 'pkg_1', { action: 'approve', coordinatorId: 'someone_else' }, pmcm)).rejects.toThrow(BadRequestException);
    expect(commands.replaceCoordinator).not.toHaveBeenCalled();

    const approved = await service.decide('evt_1', 'pkg_1', { action: 'approve', coordinatorId: 'c1' }, pmcm);
    expect(approved).toMatchObject({ status: 'approved', selectedCoordinatorId: 'c1', reviewedBy: 'Maxine' });
    expect(commands.replaceCoordinator).toHaveBeenCalledWith('evt_1', 'asg_1', expect.objectContaining({ replacementCoordinatorId: 'c1', role: 'Floor Director' }), pmcm);
    await expect(service.decide('evt_1', 'pkg_1', { action: 'reject' }, pmcm)).rejects.toThrow('already decided');
  });
});
