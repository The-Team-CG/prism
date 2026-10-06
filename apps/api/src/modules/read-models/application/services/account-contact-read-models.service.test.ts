import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AccountContactReadModelsService } from './account-contact-read-models.service';

const admin: ResolvedEventOpsActor = {
  id: 'admin_1', name: 'PMCM Admin', email: 'admin@example.test',
  role: OpsUserRole.PmcmAdmin, explicit: true, verified: true,
};
const client: ResolvedEventOpsActor = {
  id: 'client_1', name: 'Client', email: 'client@example.test',
  role: OpsUserRole.Client, explicit: true, verified: true,
};

describe('AccountContactReadModelsService', () => {
  it('returns only the earliest approved account email for a role', async () => {
    const findFirst = vi.fn(async () => ({ email: 'admin@example.test' }));
    const service = new AccountContactReadModelsService({ opsUser: { findFirst } } as never);

    await expect(service.findApprovedEmailByRole('pmcm-admin')).resolves.toBe('admin@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: { role: 'pmcm-admin', approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
  });

  it('resolves requester notification addresses by approved display name', async () => {
    const findFirst = vi.fn(async () => ({ email: 'alex@example.test' }));
    const service = new AccountContactReadModelsService({ opsUser: { findFirst } } as never);

    await expect(service.findApprovedEmailByName('Alex')).resolves.toBe('alex@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: { name: 'Alex', approvalStatus: 'approved' },
      select: { email: true },
    });
  });

  it('searches and resolves only approved Client contacts for verified PMCM actors', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' }])
      .mockResolvedValueOnce([{ id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' }]);
    const service = new AccountContactReadModelsService({ opsUser: { findFirst: vi.fn(), findMany } } as never);

    await expect(service.searchApprovedClientAccounts(' Aurora ', admin, 100)).resolves.toEqual([
      { id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' },
    ]);
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        role: OpsUserRole.Client,
        approvalStatus: 'approved',
        OR: [
          { name: { contains: 'Aurora', mode: 'insensitive' } },
          { email: { contains: 'Aurora', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 25,
    });
    await expect(service.getApprovedClientAccounts(['client_1', 'client_1'], admin)).resolves.toEqual([
      { id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' },
    ]);
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['client_1'] }, role: OpsUserRole.Client, approvalStatus: 'approved' },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('blocks unverified or non-PMCM actors from enumerating client contacts', async () => {
    const findMany = vi.fn();
    const service = new AccountContactReadModelsService({ opsUser: { findFirst: vi.fn(), findMany } } as never);

    await expect(service.searchApprovedClientAccounts('Aurora', client, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('checks current client role and approval status before allowing shared-event reads', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'client_1' });
    const service = new AccountContactReadModelsService({ opsUser: { findFirst } } as never);

    await expect(service.isApprovedClientAccount('client_1')).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'client_1', role: OpsUserRole.Client, approvalStatus: 'approved' },
      select: { id: true },
    });
  });
});
