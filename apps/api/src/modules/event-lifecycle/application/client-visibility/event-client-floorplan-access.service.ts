import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AUDIT_WRITER,
  EventAccessPolicyService,
  type AuditWriter,
  type ResolvedEventOpsActor,
  writeAudit,
} from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type {
  PrismApprovedClientAccount,
  PrismClientSharedFloorplanEvent,
  PrismEventClientAccess,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import {
  ACCOUNT_CONTACT_READ_MODEL,
  type AccountContactReadModel,
} from '@prism/contexts/read-models/account-contacts';

type ClientFloorplanAccessEvent = Prisma.OpsEventGetPayload<{
  include: { inquiry: { select: { email: true } } };
}>;

@Injectable()
export class EventClientFloorplanAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(ACCOUNT_CONTACT_READ_MODEL)
    private readonly accountContacts: AccountContactReadModel,
  ) {}

  async listAccess(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventClientAccess> {
    await this.requireAdmin(actor, eventId);
    const event = await this.requireEvent(this.prisma, eventId);
    const grants = await this.prisma.opsEventClientFloorplanAccessGrant.findMany({
      where: { eventId, active: true },
      select: { clientUserId: true },
      orderBy: [{ grantedAt: 'asc' }, { clientUserId: 'asc' }],
    });
    const secondaryContacts = await this.accountContacts.getApprovedClientAccounts(
      grants.map((grant) => grant.clientUserId),
      actor,
    );
    return {
      eventId,
      primaryContact: { name: event.clientName, email: event.inquiry.email },
      secondaryContacts,
    };
  }

  async searchCandidates(
    eventId: string,
    query: string,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismApprovedClientAccount[]> {
    await this.requireAdmin(actor, eventId);
    const event = await this.requireEvent(this.prisma, eventId);
    const [accounts, activeGrants] = await Promise.all([
      this.accountContacts.searchApprovedClientAccounts(query.trim(), actor, 25),
      this.prisma.opsEventClientFloorplanAccessGrant.findMany({
        where: { eventId, active: true },
        select: { clientUserId: true },
      }),
    ]);
    const primaryEmail = this.normalizeEmail(event.inquiry.email);
    const grantedIds = new Set(activeGrants.map((grant) => grant.clientUserId));
    return accounts.filter((account) =>
      this.normalizeEmail(account.email) !== primaryEmail && !grantedIds.has(account.id));
  }

  async grant(
    eventId: string,
    userId: string,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismEventClientAccess> {
    const actorId = await this.requireAdmin(actor, eventId);
    const event = await this.requireEvent(this.prisma, eventId);
    const target = (await this.accountContacts.getApprovedClientAccounts([userId], actor))[0];
    if (!target) throw new BadRequestException('Only existing approved Client accounts can receive floorplan access');
    if (this.normalizeEmail(target.email) === this.normalizeEmail(event.inquiry.email)) {
      throw new BadRequestException('The primary inquiry contact already has implicit floorplan access');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.opsEventClientFloorplanAccessGrant.findUnique({
          where: { eventId_clientUserId: { eventId, clientUserId: userId } },
        });
        if (existing?.active) return;

        const now = new Date();
        const saved = existing
          ? await tx.opsEventClientFloorplanAccessGrant.update({
              where: { eventId_clientUserId: { eventId, clientUserId: userId } },
              data: {
                active: true,
                grantedAt: now,
                grantedBy: actorId,
                revokedAt: null,
                revokedBy: null,
              },
            })
          : await tx.opsEventClientFloorplanAccessGrant.create({
              data: {
                id: 'client_floorplan_access_' + randomUUID(),
                eventId,
                clientUserId: userId,
                active: true,
                grantedAt: now,
                grantedBy: actorId,
              },
            });
        await this.auditChange(
          tx,
          eventId,
          actor,
          saved.id,
          target,
          'Granted secondary floorplan access',
          AuditActionType.Create,
        );
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!this.isGrantConflictError(error)) throw error;
      const concurrentlyCreated = await this.prisma.opsEventClientFloorplanAccessGrant.findUnique({
        where: { eventId_clientUserId: { eventId, clientUserId: userId } },
        select: { active: true },
      });
      if (!concurrentlyCreated?.active) throw error;
    }
    return this.listAccess(eventId, actor);
  }

  async revoke(
    eventId: string,
    userId: string,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismEventClientAccess> {
    const actorId = await this.requireAdmin(actor, eventId);
    const event = await this.requireEvent(this.prisma, eventId);
    const target = (await this.accountContacts.getApprovedClientAccounts([userId], actor))[0];
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.opsEventClientFloorplanAccessGrant.findUnique({
        where: { eventId_clientUserId: { eventId, clientUserId: userId } },
      });
      if (!existing?.active) return;

      const saved = await tx.opsEventClientFloorplanAccessGrant.update({
        where: { eventId_clientUserId: { eventId, clientUserId: userId } },
        data: { active: false, revokedAt: new Date(), revokedBy: actorId },
      });
      await this.auditChange(
        tx,
        eventId,
        actor,
        saved.id,
        target ?? { id: userId, name: userId, email: '' },
        'Revoked secondary floorplan access',
        AuditActionType.Update,
      );
    }, { isolationLevel: 'Serializable' });
    return this.listAccess(eventId, actor);
  }

  async hasActiveGrant(eventId: string, userId: string): Promise<boolean> {
    if (!(await this.accountContacts.isApprovedClientAccount(userId))) return false;
    const [event, grant] = await Promise.all([
      this.prisma.opsEvent.findUnique({
        where: { id: eventId },
        select: { id: true, clientPortalStatus: true, archived: true },
      }),
      this.prisma.opsEventClientFloorplanAccessGrant.findUnique({
        where: { eventId_clientUserId: { eventId, clientUserId: userId } },
        select: { active: true },
      }),
    ]);
    return Boolean(event && !event.archived && event.clientPortalStatus === 'unlocked' && grant?.active);
  }

  async listActiveSharedEvents(userId: string): Promise<PrismClientSharedFloorplanEvent[]> {
    if (!(await this.accountContacts.isApprovedClientAccount(userId))) return [];
    const grants = await this.prisma.opsEventClientFloorplanAccessGrant.findMany({
      where: {
        clientUserId: userId,
        active: true,
        event: { clientPortalStatus: 'unlocked', archived: false },
      },
      select: { event: { select: { id: true, eventName: true, eventDate: true } } },
      orderBy: [{ grantedAt: 'asc' }, { eventId: 'asc' }],
    });
    return grants.map(({ event: sharedEvent }) => ({
      eventId: sharedEvent.id,
      eventName: sharedEvent.eventName,
      eventDate: sharedEvent.eventDate.toISOString(),
    }));
  }

  private async auditChange(
    tx: Prisma.TransactionClient,
    eventId: string,
    actor: ResolvedEventOpsActor,
    grantId: string,
    target: PrismApprovedClientAccount,
    action: string,
    actionType: AuditActionType,
  ): Promise<void> {
    await writeAudit(
      this.auditWriter,
      eventId,
      actor.name,
      action,
      {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType,
        affectedType: 'client_floorplan_access',
        affectedId: grantId,
        affectedLabel: 'Secondary floorplan contact',
        metadata: { actorId: actor.id, clientUserId: target.id, clientEmail: target.email },
      },
      { prisma: tx, correlationId: grantId },
    );
  }

  private async requireAdmin(actor: ResolvedEventOpsActor, eventId: string): Promise<string> {
    if (!actor?.verified || !actor.id) throw new ForbiddenException('A verified PMCM actor is required');
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan access',
      eventId,
    );
    return actor.id;
  }

  private async requireEvent(
    prisma: PrismaService | Prisma.TransactionClient,
    eventId: string,
  ): Promise<ClientFloorplanAccessEvent> {
    const event = await prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: { inquiry: { select: { email: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isGrantConflictError(error: unknown): boolean {
    return Boolean(
      error
      && typeof error === 'object'
      && 'code' in error
      && (error.code === 'P2002' || error.code === 'P2034'),
    );
  }
}
