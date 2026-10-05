import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { ApprovedClientAccountReaderService } from './approved-client-account-reader.service';

const admin: ResolvedEventOpsActor = {
  id: 'admin_1', name: 'PMCM Admin', email: 'admin@example.test',
  role: OpsUserRole.PmcmAdmin, explicit: true, verified: true,
};
const system: ResolvedEventOpsActor = {
  id: 'system_1', name: 'System', email: 'system@example.test',
  role: OpsUserRole.System, explicit: true, verified: true,
};
const client: ResolvedEventOpsActor = {
  id: 'client_1', name: 'Client', email: 'client@example.test',
  role: OpsUserRole.Client, explicit: true, verified: true,
};

function makeService() {
  const prisma = {
    opsUser: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { prisma, service: new ApprovedClientAccountReaderService(prisma as never) };
}

describe('ApprovedClientAccountReaderService', () => {
  it('searches only approved Client accounts by name or email and caps results at 25', async () => {
    const { prisma, service } = makeService();
    prisma.opsUser.findMany.mockResolvedValue([
      { id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' },
    ]);

    await expect(service.searchApprovedClientAccounts(' Aurora ', admin, 100)).resolves.toEqual([
      { id: 'client_1', name: 'Aurora Events', email: 'ops@aurora.test' },
    ]);
    expect(prisma.opsUser.findMany).toHaveBeenCalledWith({
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
  });

  it.each([admin, system])('allows PMCM/System to read approved accounts by id', async (requester) => {
    const { prisma, service } = makeService();
    prisma.opsUser.findMany.mockResolvedValue([
      { id: 'client_1', name: 'Client One', email: 'one@example.test' },
    ]);

    await expect(service.getApprovedClientAccounts(['client_1', 'supplier_1'], requester)).resolves.toEqual([
      { id: 'client_1', name: 'Client One', email: 'one@example.test' },
    ]);
    expect(prisma.opsUser.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['client_1', 'supplier_1'] }, role: OpsUserRole.Client, approvalStatus: 'approved' },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('does not let a Client requester enumerate approved accounts', async () => {
    const { prisma, service } = makeService();

    await expect(service.searchApprovedClientAccounts('Aurora', client, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsUser.findMany).not.toHaveBeenCalled();
  });

  it('checks a current account role and approval status instead of trusting a grant target snapshot', async () => {
    const { prisma, service } = makeService();
    prisma.opsUser.findFirst.mockResolvedValue({ id: 'client_1' });

    await expect(service.isApprovedClientAccount('client_1')).resolves.toBe(true);
    expect(prisma.opsUser.findFirst).toHaveBeenCalledWith({
      where: { id: 'client_1', role: OpsUserRole.Client, approvalStatus: 'approved' },
      select: { id: true },
    });
  });
});
