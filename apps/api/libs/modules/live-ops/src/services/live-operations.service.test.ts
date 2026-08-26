import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LiveOperationsService } from './live-operations.service';
import { mapUrgentIssue } from '../mappers/live-ops.mappers';

type WorkflowCommandInput = {
  validateState?: () => Promise<void> | void;
  write: () => Promise<unknown>;
  sideEffects?: (result: unknown) => Promise<void> | void;
};

describe('LiveOperationsService - Urgent Issues & Attribution Security', () => {
  const mockWorkflowCommandService = {
    execute: vi.fn(async (definition: WorkflowCommandInput) => {
      await definition.validateState?.();
      const result = await definition.write();
      await definition.sideEffects?.(result);
      return result;
    }),
  };

  const mockNotificationOutboxService = {
    enqueue: vi.fn(async () => undefined),
  };

  it('enforces openedBy to verified actor.name and persists affectedArea', async () => {
    let createdRecord: Record<string, unknown> | null = null;
    const mockPrisma = {
      opsUrgentIssue: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          createdRecord = { ...data, createdAt: new Date(), updatedAt: new Date() };
          return createdRecord;
        }),
      },
      opsEventDayLog: {
        create: vi.fn(async () => ({ id: 'log_1' })),
      },
    };

    const mockAuditService = {
      audit: vi.fn(async () => undefined),
    };

    const service = new LiveOperationsService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      mockAuditService as unknown as ConstructorParameters<typeof LiveOperationsService>[1],
      mockNotificationOutboxService as unknown as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
    );

    const actor = {
      id: 'usr_coord_123',
      name: 'Francis Coordinator',
      email: 'francis@pmcm.test',
      role: 'coordinator',
    };

    const input = {
      title: 'Microphone feedback at Stage A',
      description: 'Audio screeching on main presenter mic',
      severity: 'high',
      affectedArea: 'Main Stage',
      ownerRole: 'Audio Lead',
      ownerName: 'Dan Sounds',
      openedBy: 'Spoofed Administrator', // Attempt to spoof reporter
    };

    const issue = await service.createUrgentIssue('evt_001', input, actor);

    // 1. openedBy must strictly be the verified session actor.name
    expect(issue.openedBy).toBe('Francis Coordinator');
    expect(issue.openedBy).not.toBe('Spoofed Administrator');

    // 2. affectedArea must be persisted
    expect(issue.affectedArea).toBe('Main Stage');
    expect(issue.title).toBe('Microphone feedback at Stage A');
    expect(issue.severity).toBe('high');
    expect(issue.ownerRole).toBe('Audio Lead');

    // 3. Mapper maps affectedArea
    const mapped = mapUrgentIssue(issue, () => 'on_track');
    expect(mapped.affectedArea).toBe('Main Stage');
    expect(mapped.openedBy).toBe('Francis Coordinator');

    // 4. Audit trail matches actor
    expect(mockAuditService.audit).toHaveBeenCalledWith(
      'evt_001',
      'Francis Coordinator',
      'Opened urgent issue: Microphone feedback at Stage A',
      expect.objectContaining({
        actorRole: 'coordinator',
        actorEmail: 'francis@pmcm.test',
        affectedType: 'urgent_issue',
      }),
    );
  });

  it('updates affectedArea on an existing urgent issue', async () => {
    const existing = {
      id: 'urg_test_1',
      eventId: 'evt_001',
      title: 'Power outage',
      description: 'Breaker tripped',
      severity: 'critical',
      status: 'open',
      affectedArea: 'Stage A',
      ownerRole: 'Electrician',
      ownerName: 'Bob',
      resolution: '',
      openedBy: 'Francis Coordinator',
      slaDueAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPrisma = {
      opsUrgentIssue: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
      },
      opsEventDayLog: {
        create: vi.fn(async () => ({ id: 'log_2' })),
      },
    };

    const mockAuditService = {
      audit: vi.fn(async () => undefined),
    };

    const service = new LiveOperationsService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      mockAuditService as unknown as ConstructorParameters<typeof LiveOperationsService>[1],
      mockNotificationOutboxService as unknown as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
    );

    const actor = {
      id: 'usr_admin',
      name: 'Anthony Admin',
      email: 'anthony@pmcm.test',
      role: 'pmcm-admin',
    };

    const updated = await service.updateUrgentIssue('evt_001', 'urg_test_1', {
      affectedArea: 'Entire North Wing',
      status: 'assigned',
    }, actor);

    expect(updated.affectedArea).toBe('Entire North Wing');
    expect(updated.status).toBe('assigned');
  });
});
