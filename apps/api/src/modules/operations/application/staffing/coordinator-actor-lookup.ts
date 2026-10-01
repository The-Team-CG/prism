import { NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { sameText } from './staffing.utils';

type CoordinatorActorLookup = {
  id?: string | null;
  coordinatorId?: string | null;
  email?: string | null;
};

export async function resolveCoordinatorForActor(
  prisma: Prisma.TransactionClient | PrismaService,
  actor: CoordinatorActorLookup,
) {
  const coordinators = await prisma.opsCoordinator.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  const coordinator = coordinators.find(
    (item: OpsCoordinator) =>
      sameText(actor.id, item.userId) ||
      sameText(actor.coordinatorId, item.userId) ||
      sameText(actor.coordinatorId, item.id) ||
      sameText(actor.email, item.email),
  );
  if (!coordinator) throw new NotFoundException('Coordinator profile not found for actor');
  return coordinator as OpsCoordinator;
}
