import { createHash, randomUUID } from 'node:crypto';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismaService } from '@prism/kernel/database';
import type { LiveOpsActor } from './live-ops.types';

export async function recordEventDayLog(
  prisma: PrismaService,
  eventId: string,
  actionType: string,
  actor: LiveOpsActor,
  message: string,
  relatedType?: string,
  relatedId?: string,
  metadata: Record<string, unknown> = {},
  idempotencyKey?: string,
) {
  const data = {
    id: idempotencyKey
      ? `edl_${createHash('sha256').update(idempotencyKey).digest('hex')}`
      : `edl_${randomUUID()}`,
    eventId,
    actionType,
    actor: actor.name,
    actorRole: actor.role,
    message,
    relatedType: relatedType ?? null,
    relatedId: relatedId ?? null,
    metadata: toPrismaJson(metadata),
  };

  if (idempotencyKey) {
    return prisma.opsEventDayLog.upsert({ where: { id: data.id }, create: data, update: {} });
  }
  return prisma.opsEventDayLog.create({ data });
}
