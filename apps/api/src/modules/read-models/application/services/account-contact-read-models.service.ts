import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismApprovedClientAccount } from '@prism/types';
import type { AccountContactReadModel } from '../../contracts/ports/account-contact-read-model.port';

const accountSelect = { id: true, name: true, email: true } as const;

@Injectable()
export class AccountContactReadModelsService implements AccountContactReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findApprovedEmailByRole(role: string): Promise<string | null> {
    const account = await this.prisma.opsUser.findFirst({
      where: { role, approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    return account?.email ?? null;
  }

  async findApprovedEmailByName(name: string): Promise<string | null> {
    const account = await this.prisma.opsUser.findFirst({
      where: { name, approvalStatus: 'approved' },
      select: { email: true },
    });
    return account?.email ?? null;
  }

  async searchApprovedClientAccounts(
    query: string,
    requester: ResolvedEventOpsActor,
    limit: number,
  ): Promise<PrismApprovedClientAccount[]> {
    this.requirePmcm(requester);
    const term = query.trim();
    if (!term) return [];

    const take = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 25)) : 25;
    return this.prisma.opsUser.findMany({
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
