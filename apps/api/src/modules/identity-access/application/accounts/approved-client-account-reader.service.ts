import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismApprovedClientAccount } from '@prism/types';
import type { ApprovedClientAccountReader } from '../../contracts/approved-client-account-reader.port';

const accountSelect = { id: true, name: true, email: true } as const;

@Injectable()
export class ApprovedClientAccountReaderService implements ApprovedClientAccountReader {
  constructor(private readonly prisma: PrismaService) {}

  async searchApprovedClientAccounts(
    query: string,
    requester: ResolvedEventOpsActor,
    limit: number,
  ): Promise<PrismApprovedClientAccount[]> {
    this.requirePmcm(requester);
    const term = query.trim();
    if (!term) return [];

    const take = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 25)) : 25;
    const users = await this.prisma.opsUser.findMany({
      where: {
        role: OpsUserRole.Client,
        approvalStatus: 'approved',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: accountSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
    });
    return users;
  }

  async getApprovedClientAccounts(
    userIds: string[],
    requester: ResolvedEventOpsActor,
  ): Promise<PrismApprovedClientAccount[]> {
    this.requirePmcm(requester);
    if (userIds.length === 0) return [];
    return this.prisma.opsUser.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        role: OpsUserRole.Client,
        approvalStatus: 'approved',
      },
      select: accountSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async isApprovedClientAccount(userId: string): Promise<boolean> {
    if (!userId.trim()) return false;
    const user = await this.prisma.opsUser.findFirst({
      where: { id: userId, role: OpsUserRole.Client, approvalStatus: 'approved' },
      select: { id: true },
    });
    return Boolean(user);
  }

  private requirePmcm(requester: ResolvedEventOpsActor): void {
    if (
      !requester?.verified
      || (requester.role !== OpsUserRole.PmcmAdmin && requester.role !== OpsUserRole.System)
    ) {
      throw new ForbiddenException('Only verified PMCM Admin or System actors can read Client accounts');
    }
  }
}
