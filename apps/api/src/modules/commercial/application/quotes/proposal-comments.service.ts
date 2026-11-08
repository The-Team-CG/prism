import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { CreateProposalCommentInput, PrismProposalComment } from '@prism/types';

const COMMENT_PAGE_LIMIT = 500;
const commentInclude = { proposalVersion: { select: { versionNumber: true } } } as const;
type CommentRow = Prisma.OpsProposalCommentGetPayload<{ include: typeof commentInclude }>;

function mapComment(row: CommentRow): PrismProposalComment {
  return {
    id: row.id,
    eventId: row.eventId,
    proposalVersionNumber: row.proposalVersion.versionNumber,
    authorName: row.authorName,
    authorRole: row.authorRole === OpsUserRole.Client ? 'client' : 'pmcm-admin',
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/** FR-60: the proposal comment thread. Comments never approve or request a revision; that stays with the primary contact. */
@Injectable()
export class ProposalCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  private async readableEvent(db: Prisma.TransactionClient | PrismaService, eventId: string, actor: ResolvedEventOpsActor, action: string) {
    // A client owns an event through its inquiry's contact email, so the inquiry is loaded for the read check.
    const event = await db.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, event, action);
    return event;
  }

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismProposalComment[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client], 'proposal comments', eventId);
    const event = await this.readableEvent(this.prisma, eventId, actor, 'proposal comments');
    if (actor.role === OpsUserRole.Client && event.clientPortalStatus !== 'unlocked') return [];
    // QUERY_AUDIT_ALLOW_UNBOUNDED: capped at COMMENT_PAGE_LIMIT; one event's proposal thread is short.
    const rows = await this.prisma.opsProposalComment.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: COMMENT_PAGE_LIMIT,
      include: commentInclude,
    });
    return rows.map(mapComment);
  }

  private replay(prior: CommentRow, eventId: string, body: string, actor: ResolvedEventOpsActor) {
    if (prior.eventId !== eventId || prior.body !== body || prior.authorId !== (actor.id ?? null)) {
      throw new BadRequestException('Idempotency key was reused for another proposal comment');
    }
    return mapComment(prior);
  }

  /** Comments go on the latest issued version of an active event; a client also needs an unlocked portal. */
  private async requireCommentableVersion(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.readableEvent(tx, eventId, actor, 'proposal comment');
    if (event.archived) throw new BadRequestException('Archived events cannot take proposal comments');
    if (actor.role === OpsUserRole.Client && event.clientPortalStatus !== 'unlocked') throw new ForbiddenException('The client portal is locked for this event');
    const version = await tx.opsProposalVersion.findFirst({ where: { eventId, status: 'issued' }, orderBy: { versionNumber: 'desc' } });
    if (!version?.issuedAt) throw new BadRequestException('No issued proposal is available to comment on');
    return { event, version };
  }

  async create(eventId: string, input: CreateProposalCommentInput, actor: ResolvedEventOpsActor): Promise<PrismProposalComment> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Client], 'proposal comment', eventId);
    const body = input.body.trim();
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.opsProposalComment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: commentInclude });
      if (prior) return this.replay(prior, eventId, body, actor);
      const { event, version } = await this.requireCommentableVersion(tx, eventId, actor);
      const fromClient = actor.role === OpsUserRole.Client;
      const comment = await tx.opsProposalComment.create({
        data: {
          id: `pcm_${randomUUID()}`,
          eventId,
          proposalVersionId: version.id,
          authorId: actor.id ?? null,
          authorName: actor.name,
          authorRole: fromClient ? OpsUserRole.Client : OpsUserRole.PmcmAdmin,
          body,
          idempotencyKey: input.idempotencyKey,
        },
        include: commentInclude,
      });
      const correlationId = `proposal-comment:${comment.id}`;
      await writeAudit(this.auditWriter, eventId, actor.name, `Commented on proposal version ${version.versionNumber}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        category: AuditCategory.Events,
        actionType: AuditActionType.Create,
        affectedType: 'proposal_comment',
        affectedId: comment.id,
        affectedLabel: `Proposal version ${version.versionNumber}`,
        metadata: { proposalVersionId: version.id, actorId: actor.id ?? null },
      }, { prisma: tx, correlationId, actorId: actor.id });
      await writeNotification(
        this.notificationOutboxWriter,
        eventId,
        fromClient ? 'PMCM Admin' : 'Client',
        fromClient ? `New client comment on proposal version ${version.versionNumber} for ${event.eventName}` : `PMCM replied on proposal version ${version.versionNumber} for ${event.eventName}`,
        undefined,
        { idempotencyKey: correlationId },
        { prisma: tx, correlationId, actorId: actor.id },
      );
      return mapComment(comment);
    });
  }
}
