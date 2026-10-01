import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { CreateCommunicationThreadInput, PrismCursorPage, SendCommunicationMessageInput } from '@prism/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { Inject } from '@nestjs/common';
import { PARTICIPANT_READER, type ParticipantReader } from '@prism/contexts/identity-access';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';

const messageSelect = { id: true, threadId: true, senderId: true, senderRole: true, body: true, createdAt: true } as const;
const participantSelect = { id: true, actorId: true, actorRole: true, active: true, lastReadAt: true } as const;
type MessageRow = Prisma.OpsCommunicationMessageGetPayload<{ select: typeof messageSelect }>;
type ThreadRow = Prisma.OpsCommunicationThreadGetPayload<{ select: { id: true; eventId: true; subject: true; status: true; createdBy: true; createdAt: true; updatedAt: true; participants: { where: { active: true }; select: typeof participantSelect }; messages: { take: 101; orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]; select: typeof messageSelect } } }>;
type MessageCursor = { createdAt: string; id: string };

function encodeCursor(cursor: MessageCursor) { return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url'); }
function decodeCursor(value?: string): MessageCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<MessageCursor>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string' || Number.isNaN(new Date(parsed.createdAt).getTime())) throw new Error('invalid');
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch { throw new BadRequestException('Invalid communication message cursor'); }
}
function normalizeLimit(value?: number) { return !Number.isFinite(value) || !value || value < 1 ? 100 : Math.min(Math.trunc(value), 100); }

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService, @Inject(PARTICIPANT_READER) private readonly participants: ParticipantReader, @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter, @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter) {}

  async createThread(input: CreateCommunicationThreadInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'communication thread', input.eventId);
    if (!actor.id) throw new BadRequestException('Thread creator requires a verified account');
    const resolved = await Promise.all([...new Set(input.participantActorIds ?? [])].map((id) => this.participants.resolveForEvent(id, input.eventId)));
    const members = [actor, ...resolved.filter((candidate) => candidate.id !== actor.id)];
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.opsCommunicationThread.create({ data: { id: `thread_${randomUUID()}`, eventId: input.eventId, subject: input.subject.trim(), createdBy: actor.id! } });
      await tx.opsCommunicationParticipant.createMany({ data: members.map((member) => ({ id: `participant_${randomUUID()}`, threadId: thread.id, actorId: member.id!, actorRole: member.role, actorEmail: member.email ?? null })) });
      await writeAudit(this.auditWriter, input.eventId, actor.name, `Created communication thread: ${thread.id}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'communication', affectedType: 'communication_thread', affectedId: thread.id, affectedLabel: thread.subject }, { prisma: tx, actorId: actor.id, correlationId: `communication-thread:${thread.id}` });
      const result = await this.thread(tx, thread.id);
      return result ? this.safeThread(result, actor.id!) : result;
    });
  }

  listEligibleParticipants(eventId: string, actor: ResolvedEventOpsActor) { return this.participants.listEligibleForEvent(eventId, actor); }

  async listThreads(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], 'communication threads', eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', eventId);
    const rows = await this.prisma.opsCommunicationThread.findMany({ take: 100, where: { eventId, participants: { some: { actorId: verified.id!, active: true } } }, select: { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true, participants: { where: { active: true }, select: participantSelect }, messages: { take: 101, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } }, orderBy: { updatedAt: 'desc' } });
    const unreadByThread = await this.unreadCounts(rows, verified.id!);
    return rows.map((row) => this.safeThread(row, verified.id!, unreadByThread.get(row.id) ?? 0));
  }

  async listMessages(threadId: string, query: { cursor?: string; limit?: number }, actor: ResolvedEventOpsActor): Promise<PrismCursorPage<ReturnType<CommunicationService['safeMessage']>>> {
    const { verified } = await this.authorizeThread(threadId, actor, 'communication messages');
    await this.ensureMembership(threadId, verified.id!);
    const cursor = decodeCursor(query.cursor);
    const limit = normalizeLimit(query.limit);
    const where = cursor
      ? {
          threadId,
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        }
      : { threadId };
    const rows = await this.prisma.opsCommunicationMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: messageSelect,
    });
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const nextCursor = hasMore && pageRows.length ? encodeCursor({ createdAt: pageRows[pageRows.length - 1].createdAt.toISOString(), id: pageRows[pageRows.length - 1].id }) : null;
    return { items: pageRows.reverse().map((message) => this.safeMessage(message)), limit, nextCursor, hasMore };
  }

  async markThreadRead(threadId: string, actor: ResolvedEventOpsActor) {
    const { verified } = await this.authorizeThread(threadId, actor, 'mark communication thread read');
    await this.ensureMembership(threadId, verified.id!);
    const lastReadAt = new Date();
    await this.prisma.opsCommunicationParticipant.updateMany({ where: { threadId, actorId: verified.id!, active: true }, data: { lastReadAt } });
    return { lastReadAt: lastReadAt.toISOString() };
  }

  async sendMessage(threadId: string, input: SendCommunicationMessageInput, actor: ResolvedEventOpsActor) {
    const { thread, verified } = await this.authorizeThread(threadId, actor, 'communication message');
    const body = input.body.trim();
    const payloadHash = createHash('sha256').update(JSON.stringify({ threadId, senderId: verified.id, body })).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize message sequencing and idempotency checks for this thread.
      await tx.$queryRaw`SELECT id FROM "supplier_ops"."communication_threads" WHERE id = ${threadId} FOR UPDATE`;
      const membership = await tx.opsCommunicationParticipant.findFirst({ where: { threadId, actorId: verified.id!, active: true }, select: { id: true } });
      if (!membership) throw new ForbiddenException('Actor is no longer an active thread participant');
      const replay = await tx.opsCommunicationMessage.findUnique({ where: { threadId_idempotencyKey: { threadId, idempotencyKey: input.idempotencyKey } }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      if (replay) {
        if (replay.payloadHash !== payloadHash || replay.senderId !== verified.id) throw new BadRequestException('Idempotency key was already used for a different message');
        return this.safeMessage(replay);
      }
      const message = await tx.opsCommunicationMessage.create({ data: { id: `message_${randomUUID()}`, threadId, senderId: verified.id!, senderRole: verified.role, senderEmail: verified.email ?? null, body, payloadHash, idempotencyKey: input.idempotencyKey }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Sent communication message: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'create', category: 'communication', affectedType: 'communication_message', affectedId: message.id, affectedLabel: threadId, metadata: { idempotencyKey: input.idempotencyKey } }, { prisma: tx, actorId: verified.id, correlationId: `communication-message:${message.id}` });
      const recipients = await tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true, actorId: { not: verified.id } }, select: { actorEmail: true } });
      await Promise.all(recipients.filter((recipient) => recipient.actorEmail).map((recipient) => writeNotification(this.notificationOutboxWriter, thread.eventId, recipient.actorEmail!, `New message in ${threadId}`, 'email', { idempotencyKey: `communication-message:${message.id}:${recipient.actorEmail}` }, { prisma: tx, correlationId: `communication-message:${message.id}` })));
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return this.safeMessage(message);
    });
  }

  private async authorizeThread(threadId: string, actor: ResolvedEventOpsActor, resource: string) {
    const thread = await this.prisma.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { id: true, eventId: true } });
    if (!thread) throw new NotFoundException('Communication thread not found');
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier], resource, thread.eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', thread.eventId);
    return { thread, verified };
  }

  private async ensureMembership(threadId: string, actorId: string) {
    const membership = await this.prisma.opsCommunicationParticipant.findFirst({ where: { threadId, actorId, active: true }, select: { id: true } });
    if (!membership) throw new ForbiddenException('Actor is not an active thread participant');
  }

  private async unreadCounts(rows: ThreadRow[], actorId: string) {
    const readAt = new Map(rows.map((row) => [row.id, row.participants.find((participant) => participant.actorId === actorId)?.lastReadAt ?? null]));
    const dates = [...readAt.values()].filter((value): value is Date => value instanceof Date);
    const messages = rows.length && dates.length ? await this.prisma.opsCommunicationMessage.findMany({ where: { threadId: { in: rows.map((row) => row.id) }, senderId: { not: actorId }, createdAt: { gt: new Date(Math.min(...dates.map((date) => date.getTime()))) } }, select: { threadId: true, createdAt: true } }) : rows.length ? await this.prisma.opsCommunicationMessage.findMany({ where: { threadId: { in: rows.map((row) => row.id) }, senderId: { not: actorId } }, select: { threadId: true, createdAt: true } }) : [];
    const counts = new Map<string, number>();
    for (const message of messages) { const lastRead = readAt.get(message.threadId); if (!lastRead || message.createdAt > lastRead) counts.set(message.threadId, (counts.get(message.threadId) ?? 0) + 1); }
    return counts;
  }

  private thread(db: PrismaService | Prisma.TransactionClient, id: string) {
    return db.opsCommunicationThread.findUnique({ where: { id }, select: { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true, participants: { where: { active: true }, select: participantSelect }, messages: { take: 101, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } } });
  }
  private safeMessage(message: Pick<MessageRow, 'id' | 'threadId' | 'senderId' | 'senderRole' | 'body' | 'createdAt'>) { return { id: message.id, threadId: message.threadId, senderId: message.senderId, senderRole: message.senderRole, body: message.body, createdAt: message.createdAt.toISOString() }; }
  private safeThread(row: ThreadRow, actorId: string, unreadCount = 0) { const messages = row.messages.slice(0, 100); const oldest = messages[messages.length - 1]; const participants = row.participants.map((participant) => participant.actorId === actorId ? participant : { id: participant.id, actorId: participant.actorId, actorRole: participant.actorRole, active: participant.active }); return { id: row.id, eventId: row.eventId, subject: row.subject, status: row.status, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), participants, messages: messages.reverse().map((message) => this.safeMessage(message)), messagesNextCursor: row.messages.length > 100 && oldest ? encodeCursor({ createdAt: oldest.createdAt.toISOString(), id: oldest.id }) : null, unreadCount }; }
}
