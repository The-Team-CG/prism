import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismOwnSession, PrismOwnSessionsSignedOut, PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { writeAudit } from '@prism/kernel/access-control';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';

/**
 * Where the signed-in person is signed in, and signing devices out. Each sign-in records one row per browser (see
 * AuthOperationsService.issueUserSession); the session guard refuses a token whose row is signed out.
 */
@Injectable()
export class OwnSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT) private readonly authAudit: AuthAuditPort,
  ) {}

  /** Browsers signed in now, this one first, then the most recently active. */
  async list(actor: PrismVerifiedEventActor): Promise<PrismOwnSession[]> {
    const rows = await this.prisma.opsUserSession.findMany({
      where: this.liveWhere(actor, new Date()),
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, device: true, createdAt: true, lastSeenAt: true },
      take: 50,
    });
    return rows
      .map((row) => ({
        id: row.id,
        device: row.device,
        signedInAt: row.createdAt.toISOString(),
        lastActiveAt: row.lastSeenAt.toISOString(),
        current: row.id === actor.sessionId,
      }))
      .sort((left, right) => Number(right.current) - Number(left.current));
  }

  /** Signs out one other browser. This browser signs out with Sign out instead, which ends the visit here. */
  async signOut(actor: PrismVerifiedEventActor, sessionId: string): Promise<void> {
    if (sessionId === actor.sessionId) throw new BadRequestException('Use Sign out to sign out of this device.');
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.opsUserSession.updateMany({
        where: { ...this.liveWhere(actor, new Date()), id: sessionId },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new NotFoundException('That device is already signed out.');
      await this.audit(tx, actor, 'Signed out another device', { signedOut: 1 });
    });
  }

  /** Signs out every browser but this one. */
  async signOutOthers(actor: PrismVerifiedEventActor): Promise<PrismOwnSessionsSignedOut> {
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.opsUserSession.updateMany({
        where: { ...this.liveWhere(actor, new Date()), id: { not: actor.sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, actor, 'Signed out every other device', { signedOut: revoked.count });
      return { signedOut: revoked.count };
    });
  }

  /** Rows of this person's current session version that have not ended. An earlier version's rows are dead. */
  private liveWhere(actor: PrismVerifiedEventActor, now: Date): Prisma.OpsUserSessionWhereInput {
    return { userId: actor.id, sessionVersion: actor.sessionVersion ?? 0, revokedAt: null, expiresAt: { gt: now } };
  }

  private audit(tx: Prisma.TransactionClient, actor: PrismVerifiedEventActor, action: string, metadata: Record<string, unknown>) {
    return writeAudit(this.authAudit, undefined, actor.name, action, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: actor.id,
      affectedLabel: actor.email,
      metadata,
    }, { prisma: tx, correlationId: actor.id, actorId: actor.id });
  }
}
