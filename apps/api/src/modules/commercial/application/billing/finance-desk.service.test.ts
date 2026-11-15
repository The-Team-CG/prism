import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { FinanceDeskService } from './finance-desk.service';

const actor = (role: string): PrismVerifiedEventActor => ({ id: `user-${role}`, actorId: `user-${role}`, role, actorRole: role, email: `${role}@example.test`, actorEmail: `${role}@example.test`, name: role, actorName: role, expiresAt: '2099-01-01' } as PrismVerifiedEventActor);

describe('FinanceDeskService', () => {
  it('shows finance across events to PMCM only, refusing every other role before reading anything', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = new Proxy({}, { get: () => ({ findMany }) });
    const service = new FinanceDeskService(prisma as never, new EventAccessPolicyService({ write: vi.fn() } as never));

    for (const role of [OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest]) {
      await expect(service.desk(actor(role))).rejects.toThrow(ForbiddenException);
    }
    expect(findMany).not.toHaveBeenCalled();
    await expect(service.desk(actor(OpsUserRole.PmcmAdmin), new Date('2026-11-14T02:00:00Z'))).resolves.toMatchObject({ queue: [], events: [], payouts: [] });
  });
});
