import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { describe, expect, it, vi } from 'vitest';
import { EventInsightGenerationService } from './event-insight-generation.service';

const actor = { id: 'pmcm_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test', explicit: true };
const facts = {
  assignments: 3,
  awaitingAcknowledgement: 1,
  lateAttendance: 1,
  absentAttendance: 0,
  replacedAssignments: 0,
  cancelledAssignments: 1,
  reliabilityNotes: 2,
};

function harness(roleCheck = vi.fn(async () => undefined)) {
  const closureCommands = { generateEventInsights: vi.fn(async () => ({ id: 'ins_1' })) };
  const coordinatorFactsReader = { getForEvent: vi.fn(async () => facts) };
  const accessPolicy = { requireActorRole: roleCheck };
  const service = new EventInsightGenerationService(closureCommands as never, coordinatorFactsReader as never, accessPolicy as never);
  return { service, closureCommands, coordinatorFactsReader, accessPolicy };
}

describe('EventInsightGenerationService', () => {
  it('authorizes first, then composes event-scoped coordinator facts into the lifecycle-owned write', async () => {
    const roleCheck = vi.fn(async () => undefined);
    const { service, closureCommands, coordinatorFactsReader } = harness(roleCheck);

    await expect(service.generate('evt_1', actor)).resolves.toEqual({ id: 'ins_1' });

    expect(roleCheck).toHaveBeenCalledWith(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event insights', 'evt_1');
    expect(coordinatorFactsReader.getForEvent).toHaveBeenCalledWith('evt_1');
    expect(closureCommands.generateEventInsights).toHaveBeenCalledWith('evt_1', actor, facts);
  });

  it('does not read coordinator facts when role authorization fails', async () => {
    const roleCheck = vi.fn(async () => { throw new ForbiddenException('coordinator cannot access event insights'); });
    const { service, closureCommands, coordinatorFactsReader } = harness(roleCheck);

    await expect(service.generate('evt_1', { ...actor, role: OpsUserRole.Coordinator })).rejects.toBeInstanceOf(ForbiddenException);

    expect(coordinatorFactsReader.getForEvent).not.toHaveBeenCalled();
    expect(closureCommands.generateEventInsights).not.toHaveBeenCalled();
  });
});
