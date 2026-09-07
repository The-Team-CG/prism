import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { CreateCommunicationThreadInput, SendCommunicationMessageInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { Inject } from '@nestjs/common';
import { PARTICIPANT_READER, type ParticipantReader } from '@prism/contexts/identity-access';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService, @Inject(PARTICIPANT_READER) private readonly participants: ParticipantReader, @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter, @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter) {}

  async createThread(input: CreateCommunicationThreadInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'communication thread', input.eventId);
    if (!actor.id) throw new BadRequestException('Thread creator requires a verified account');
    const resolved = await Promise.all([...new Set(input.participantActorIds ?? [])].map((id) => this.participants.resolveForEvent(id, input.eventId)));
    const members = [actor, ...resolved.filter((candidate) => candidate.id !== actor.id)];
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.opsCommunicationThread.create({ data: { id: `thread_${randomUUID()}`, eventId: input.eventId, subject: input.subject.trim(), createdBy: actor.id ?? actor.name } });
      await tx.opsCommunicationParticipant.createMany({ data: members.map((member) => ({ id: `participant_${randomUUID()}`, threadId: thread.id, actorId: member.id!, actorRole: member.role, actorEmail: member.email ?? null })) });
      const result = await this.thread(tx, thread.id);
      return result ? this.safeThread(result) : result;
    });
  }

  async listThreads(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], 'communication threads', eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', eventId);
    const rows = await this.prisma.opsCommunicationThread.findMany({ take: 100, where: { eventId, participants: { some: { actorId: verified.id!, active: true } } }, include: { participants: { where: { active: true }, select: { id: true, actorId: true, actorRole: true, active: true } }, messages: { take: 100, orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
    return rows.map((row) => this.safeThread(row));
  }

  async sendMessage(threadId: string, input: SendCommunicationMessageInput, actor: ResolvedEventOpsActor) {
    const thread = await this.prisma.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { id: true, eventId: true } });
    if (!thread) throw new NotFoundException('Communication thread not found');
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], 'communication message', thread.eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', thread.eventId);
    const body = input.body.trim();
    const payloadHash = createHash('sha256').update(JSON.stringify({ threadId, senderId: verified.id, body })).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "supplier_ops"."communication_threads" WHERE id = ${threadId} FOR UPDATE`;
      const membership = await tx.opsCommunicationParticipant.findFirst({ where: { threadId, actorId: verified.id!, active: true }, select: { id: true } });
      if (!membership) throw new ForbiddenException('Actor is no longer an active thread participant');
      const replay = await tx.opsCommunicationMessage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.payloadHash !== payloadHash || replay.threadId !== threadId || replay.senderId !== verified.id) throw new BadRequestException('Idempotency key was already used for a different message');
        return this.safeMessage(replay);
      }
      const message = await tx.opsCommunicationMessage.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        create: { id: `message_${randomUUID()}`, threadId, senderId: verified.id!, senderRole: verified.role, senderEmail: verified.email ?? null, body, payloadHash, idempotencyKey: input.idempotencyKey },
        update: { idempotencyKey: input.idempotencyKey },
      });
      if (message.payloadHash !== payloadHash || message.threadId !== threadId || message.senderId !== verified.id) {
        throw new BadRequestException('Idempotency key was already used for a different message');
      }
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Sent communication message: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'create', category: 'communication', affectedType: 'communication_message', affectedId: message.id, affectedLabel: threadId, metadata: { idempotencyKey: input.idempotencyKey } }, { prisma: tx, actorId: verified.id, correlationId: `communication-message:${message.id}` });
      const recipients = await tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true, actorId: { not: verified.id } }, select: { actorEmail: true } });
      await Promise.all(recipients.filter((recipient) => recipient.actorEmail).map((recipient) => writeNotification(this.notificationOutboxWriter, thread.eventId, recipient.actorEmail!, `New message in ${threadId}`, 'email', { idempotencyKey: `communication-message:${message.id}:${recipient.actorEmail}` }, { prisma: tx, correlationId: `communication-message:${message.id}` })));
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return this.safeMessage(message);
    });
  }

  private safeMessage(message: { id: string; threadId: string; senderId: string; senderRole: string; body: string; createdAt: Date }) {
    return { id: message.id, threadId: message.threadId, senderId: message.senderId, senderRole: message.senderRole, body: message.body, createdAt: message.createdAt.toISOString() };
  }

  private thread(db: PrismaService | Prisma.TransactionClient, id: string) {
    return db.opsCommunicationThread.findUnique({ where: { id }, select: { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true, participants: { where: { active: true }, select: { id: true, actorId: true, actorRole: true, active: true } }, messages: { take: 100, orderBy: { createdAt: 'asc' }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, createdAt: true } } } });
  }

  private safeThread(row: { id: string; eventId: string; subject: string; status: string; createdBy: string; createdAt: Date; updatedAt: Date; participants: Array<{ id: string; actorId: string; actorRole: string; active: boolean }>; messages: Array<{ id: string; threadId: string; senderId: string; senderRole: string; body: string; createdAt: Date }> }) {
    return {
      id: row.id,
      eventId: row.eventId,
      subject: row.subject,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      participants: row.participants,
      messages: row.messages.map((message) => this.safeMessage(message)),
    };
  }
}
