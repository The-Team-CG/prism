import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { CreateCommunicationThreadInput, SendCommunicationMessageInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService) {}

  async createThread(input: CreateCommunicationThreadInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'communication thread', input.eventId);
    const ids = [...new Set([actor.id ?? actor.name, ...(input.participantActorIds ?? [])])];
    if (ids.some((id) => !id)) throw new BadRequestException('Thread participants require verified actor identities');
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.opsCommunicationThread.create({ data: { id: `thread_${randomUUID()}`, eventId: input.eventId, subject: input.subject.trim(), createdBy: actor.id ?? actor.name } });
      await tx.opsCommunicationParticipant.createMany({ data: ids.map((actorId) => ({ id: `participant_${randomUUID()}`, threadId: thread.id, actorId, actorRole: actorId === (actor.id ?? actor.name) ? actor.role : 'unknown', actorEmail: actorId === actor.id ? actor.email ?? null : null })) });
      return this.thread(tx, thread.id);
    });
  }

  async listThreads(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], 'communication threads', eventId);
    const rows = await this.prisma.opsCommunicationThread.findMany({ where: { eventId, participants: { some: { actorId: actor.id ?? actor.name, active: true } } }, include: { participants: { where: { active: true } }, messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
    return rows;
  }

  async sendMessage(threadId: string, input: SendCommunicationMessageInput, actor: ResolvedEventOpsActor) {
    const thread = await this.prisma.opsCommunicationThread.findUnique({ where: { id: threadId }, include: { participants: { where: { active: true } } } });
    if (!thread) throw new NotFoundException('Communication thread not found');
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], 'communication message', thread.eventId);
    if (!thread.participants.some((p) => p.actorId === (actor.id ?? actor.name))) throw new ForbiddenException('Actor is not an active thread participant');
    const payloadHash = createHash('sha256').update(JSON.stringify({ threadId, senderId: actor.id ?? actor.name, body: input.body.trim() })).digest('hex');
    const existing = await this.prisma.opsCommunicationMessage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new BadRequestException('Idempotency key was already used for a different message');
      return existing;
    }
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.opsCommunicationMessage.create({ data: { id: `message_${randomUUID()}`, threadId, senderId: actor.id ?? actor.name, senderRole: actor.role, senderEmail: actor.email ?? null, body: input.body.trim(), payloadHash, idempotencyKey: input.idempotencyKey } });
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return message;
    });
  }

  private thread(db: PrismaService | Prisma.TransactionClient, id: string) {
    return db.opsCommunicationThread.findUnique({ where: { id }, include: { participants: { where: { active: true } }, messages: { orderBy: { createdAt: 'asc' } } } });
  }
}
