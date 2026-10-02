import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { AuditWriteInput, ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { describe, expect, it, vi } from 'vitest';
import { ClientEventDayViewService } from './client-event-day-view.service';

const eventId = 'evt_event_day_view';

function actor(role: ResolvedEventOpsActor['role']): ResolvedEventOpsActor {
  return {
    id: role === OpsUserRole.PmcmAdmin ? 'pmcm_1' : `${role}_1`,
    role,
    name: role === OpsUserRole.PmcmAdmin ? 'Maxine' : role,
    explicit: true,
    verified: true,
  };
}

function createScenario(initialEnabled = false, eventExists = true) {
  let enabled = initialEnabled;
  const opsEvent = {
    findUnique: vi.fn(async () => (eventExists ? { id: eventId, clientEventDayViewEnabled: enabled } : null)),
    update: vi.fn(async ({ data }: { data: { clientEventDayViewEnabled: boolean } }) => {
      enabled = data.clientEventDayViewEnabled;
      return { id: eventId, clientEventDayViewEnabled: enabled };
    }),
  };
  const prisma = { opsEvent };
  const transactionRunner = {
    run: vi.fn(async (work: (context: { prisma: typeof prisma; correlationId: string }) => Promise<unknown>) =>
      work({ prisma, correlationId: 'cmd_test_event_day_view' }),
    ),
  };
  const workflow = new WorkflowCommandService(transactionRunner as never);
  const requireActorRole = vi.fn(async (
    currentActor: ResolvedEventOpsActor,
    allowedRoles: ResolvedEventOpsActor['role'][],
  ) => {
    if (!allowedRoles.includes(currentActor.role)) throw new ForbiddenException('forbidden');
  });
  const accessPolicy = { requireActorRole };
  const write = vi.fn(async (_input: AuditWriteInput) => undefined);
  const auditWriter = { write };
  const service = new ClientEventDayViewService(
    prisma as never,
    accessPolicy as never,
    auditWriter as never,
    workflow,
  );

  return { service, opsEvent, requireActorRole, write, transactionRunner };
}

describe('ClientEventDayViewService', () => {
  it('enables and disables event-day visibility with audit before/after values', async () => {
    const scenario = createScenario(false);
    const pmcmAdmin = actor(OpsUserRole.PmcmAdmin);

    await expect(scenario.service.setClientEventDayView(eventId, { enabled: true }, pmcmAdmin)).resolves.toEqual({
      eventId,
      enabled: true,
    });
    await expect(scenario.service.setClientEventDayView(eventId, { enabled: false }, pmcmAdmin)).resolves.toEqual({
      eventId,
      enabled: false,
    });

    expect(scenario.opsEvent.update).toHaveBeenNthCalledWith(1, {
      where: { id: eventId },
      data: { clientEventDayViewEnabled: true },
      select: { id: true, clientEventDayViewEnabled: true },
    });
    expect(scenario.write).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventId,
        actor: 'Maxine',
        action: 'Updated client event-day visibility',
        actorRole: OpsUserRole.PmcmAdmin,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'event',
        affectedId: eventId,
        metadata: { previousEnabled: false, enabled: true },
      }),
      expect.objectContaining({ correlationId: 'cmd_test_event_day_view' }),
    );
    expect(scenario.write).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ metadata: { previousEnabled: true, enabled: false } }),
      expect.objectContaining({ correlationId: 'cmd_test_event_day_view' }),
    );
    expect(scenario.transactionRunner.run).toHaveBeenCalledTimes(2);
  });

  it.each([OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest])(
    'rejects %s from changing visibility',
    async (role) => {
      const scenario = createScenario(false);

      await expect(scenario.service.setClientEventDayView(eventId, { enabled: true }, actor(role))).rejects.toThrow(
        'forbidden',
      );

      expect(scenario.opsEvent.update).not.toHaveBeenCalled();
      expect(scenario.write).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing event without updating or auditing', async () => {
    const scenario = createScenario(false, false);

    await expect(
      scenario.service.setClientEventDayView(eventId, { enabled: true }, actor(OpsUserRole.PmcmAdmin)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(scenario.opsEvent.update).not.toHaveBeenCalled();
    expect(scenario.write).not.toHaveBeenCalled();
  });
});
