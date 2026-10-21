import { Inject, Injectable } from '@nestjs/common';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter } from '@prism/kernel/access-control';
import type { GameAuditSafeStatus } from '../contracts/game-persistence.port';
import type { GameAuditPort, GameHostWriteAuditInput } from '../contracts/game-audit.port';

const GAME_AUDIT_SAFE_STATUSES = new Set<GameAuditSafeStatus>([
  'draft',
  'published',
  'scheduled',
  'lobby',
  'active',
  'live',
  'paused',
  'ended',
  'completed',
  'cancelled',
  'archived',
  'removed',
  'revoked',
  'hidden',
  'prism',
  'ocean',
  'sunset',
  'forest',
  'open',
  'closed',
  'pending',
  'visible',
  'assigned',
]);

function isSafeStatus(value: unknown): value is GameAuditSafeStatus | null {
  return value === null || (typeof value === 'string' && GAME_AUDIT_SAFE_STATUSES.has(value as GameAuditSafeStatus));
}

function isSafeVersion(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

@Injectable()
export class GameAuditAdapter implements GameAuditPort {
  constructor(@Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter) {}

  async recordHostWrite(input: GameHostWriteAuditInput, transaction: Parameters<GameAuditPort['recordHostWrite']>[1]): Promise<void> {
    if (
      !isSafeStatus(input.transition.beforeStatus) ||
      !isSafeStatus(input.transition.afterStatus) ||
      !isSafeVersion(input.transition.beforeVersion) ||
      !isSafeVersion(input.transition.afterVersion)
    ) {
      throw new Error('Event game audit transition contains unsupported state metadata');
    }

    await this.auditWriter.write({
      eventId: input.eventId,
      actor: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      actionType: AuditActionType.General,
      category: AuditCategory.Events,
      affectedType: 'event_game',
      affectedId: input.resourceId,
      affectedLabel: input.action,
      createdAt: input.timestamp,
      metadata: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: input.outcome,
        resultId: input.resultId,
        requestReceiptId: input.requestReceiptId,
        beforeStatus: input.transition.beforeStatus,
        afterStatus: input.transition.afterStatus,
        beforeVersion: input.transition.beforeVersion,
        afterVersion: input.transition.afterVersion,
      },
    }, transaction);
  }
}
