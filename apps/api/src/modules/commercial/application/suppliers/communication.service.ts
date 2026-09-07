import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { CreateCommunicationThreadInput, SendCommunicationMessageInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { Inject } from '@nestjs/common';
import { PARTICIPANT_READER, type ParticipantReader } from '../../../identity-access/contracts/participant-reader.port';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService, @Inject(PARTICIPANT_READER) private readonly participants: ParticipantReader) {}

  async createThread(input: CreateCommunicationThreadInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'communication thread', input.eventId);
    if (!actor.id) throw new BadRequestException('Thread creator requires a verified account');
    const resolved = await Promise.all([...new Set(input.participantActorIds ?? [])].map((id) => this.participants.resolveForEvent(id, input.eventId)));
    const members = [actor, ...resolved.filter((candidate) => candidate.id !== actor.id)];
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.opsCommunicationThread.create({ data: { id: `thread_${randomUUID()}`, eventId: input.eventId, subject: input.subject.trim(), createdBy: actor.id ?? actor.name } });
      await tx.opsCommunicationParticipant.createMany({ data: members.map((member) => ({ id: `participant_${randomUUID()}`, threadId: thread.id, actorId: member.id!, actorRole: member.role, actorEmail: member.email ?? null })) });
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
