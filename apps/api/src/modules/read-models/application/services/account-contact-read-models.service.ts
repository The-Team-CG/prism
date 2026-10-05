import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { AccountContactReadModel } from '../../contracts/ports/account-contact-read-model.port';

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
}
