import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { CreateCommunicationThreadInput, PrismCommunicationInboxThread, PrismCursorPage, SendCommunicationMessageInput } from '@prism/types';
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
type InboxRow = Omit<ThreadRow, 'messages'> & { messages: MessageRow[] };
type Names = ReadonlyMap<string, string>;
type MessageCursor = { createdAt: string; id: string };
const threadFields = { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true } as const;
const readerRoles = [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier];
const ROLE_LABELS: Record<string, string> = { [OpsUserRole.PmcmAdmin]: 'PMCM', [OpsUserRole.System]: 'PMCM', [OpsUserRole.Client]: 'Client', [OpsUserRole.Supplier]: 'Supplier', [OpsUserRole.Coordinator]: 'Coordinator' };
const PREVIEW_LENGTH = 140;

/**
 * What a new-message notice says, on every channel: who wrote, in which conversation and event, and the start of
 * the message, so it can be read without signing in (FR-64).
 */
export function newMessageNotice(input: { senderName: string; senderRole: string; subject: string; eventName?: string; body: string }) {
  const text = input.body.replaceAll(/\s+/g, ' ').trim();
  const preview = text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : text;
  const role = ROLE_LABELS[input.senderRole];
  const sender = role && role !== input.senderName ? `${input.senderName} (${role})` : input.senderName;
  const where = input.eventName ? `"${input.subject}" for ${input.eventName}` : `"${input.subject}"`;
  return `New message from ${sender} in ${where}: ${preview}`;
}

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
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier], 'communication thread', input.eventId);
    if (!actor.id) throw new BadRequestException('Thread creator requires a verified account');
    const resolved = await this.threadRecipients(input, actor);
    const members = [actor, ...resolved.filter((candidate) => candidate.id !== actor.id)];
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.opsCommunicationThread.create({ data: { id: `thread_${randomUUID()}`, eventId: input.eventId, subject: input.subject.trim(), createdBy: actor.id! } });
      await tx.opsCommunicationParticipant.createMany({ data: members.map((member) => ({ id: `participant_${randomUUID()}`, threadId: thread.id, actorId: member.id!, actorRole: member.role, actorEmail: member.email ?? null })) });
      await writeAudit(this.auditWriter, input.eventId, actor.name, `Created communication thread: ${thread.id}`, { actorRole: actor.role, actorEmail: actor.email, actionType: 'create', category: 'communication', affectedType: 'communication_thread', affectedId: thread.id, affectedLabel: thread.subject }, { prisma: tx, actorId: actor.id, correlationId: `communication-thread:${thread.id}` });
      const result = await this.thread(tx, thread.id);
      return result ? this.safeThread(result, actor.id!, 0, await this.names([result], tx)) : result;
    });
  }

  /** PMCM picks recipients. A booked supplier cannot: their thread always goes to the PMCM admins. */
  private async threadRecipients(input: CreateCommunicationThreadInput, actor: ResolvedEventOpsActor) {
    if (actor.role !== OpsUserRole.Supplier) {
      return Promise.all([...new Set(input.participantActorIds ?? [])].map((id) => this.participants.resolveForEvent(id, input.eventId)));
    }
    if (input.participantActorIds?.length) throw new ForbiddenException('Suppliers cannot choose conversation participants');
    await this.participants.resolveForEvent(actor.id!, input.eventId);
    return this.participants.listPmcmAdmins();
  }

  listEligibleParticipants(eventId: string, actor: ResolvedEventOpsActor) { return this.participants.listEligibleForEvent(eventId, actor); }

  async listThreads(eventId: string, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, readerRoles, 'communication threads', eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', eventId);
    const rows = await this.prisma.opsCommunicationThread.findMany({ take: 100, where: { eventId, participants: { some: { actorId: verified.id!, active: true } } }, select: { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true, participants: { where: { active: true }, select: participantSelect }, messages: { take: 101, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } }, orderBy: { updatedAt: 'desc' } });
    const [unreadByThread, names] = await Promise.all([this.unreadCounts(rows, verified.id!), this.names(rows)]);
    return rows.map((row) => this.safeThread(row, verified.id!, unreadByThread.get(row.id) ?? 0, names));
  }

  /** Every conversation the account is in, across the events it can still read, most recent activity first. */
  async listInbox(actor: ResolvedEventOpsActor): Promise<PrismCommunicationInboxThread[]> {
    await this.access.requireActorRole(actor, readerRoles, 'communication inbox');
    if (!actor.id) throw new BadRequestException('The inbox requires a verified account');
    const actorId = actor.id;
    const rows: InboxRow[] = await this.prisma.opsCommunicationThread.findMany({ take: 100, where: { participants: { some: { actorId, active: true } } }, select: { ...threadFields, participants: { where: { active: true }, select: participantSelect }, messages: { take: 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } }, orderBy: { updatedAt: 'desc' } });
    // Membership alone is not access: a cancelled booking or a locked portal hides that event's conversations here too.
    const readable = await this.participants.readableEventIds(actorId, rows.map((row) => row.eventId));
    const visible = rows.filter((row) => readable.has(row.eventId));
    if (!visible.length) return [];
    const [events, unreadByThread, names] = await Promise.all([
      this.prisma.opsEvent.findMany({ where: { id: { in: [...new Set(visible.map((row) => row.eventId))] } }, select: { id: true, eventName: true } }),
      this.unreadCounts(visible, actorId),
      this.names(visible),
    ]);
    const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
    return visible.map((row) => {
      const { messages, messagesNextCursor: _history, ...thread } = this.safeThread(row, actorId, unreadByThread.get(row.id) ?? 0, names);
      return { ...thread, eventName: eventNames.get(row.eventId) ?? '', lastMessage: messages[0] ?? null };
    });
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
    const names = await this.participants.displayNames(pageRows.map((message) => message.senderId));
    return { items: pageRows.reverse().map((message) => this.safeMessage(message, names)), limit, nextCursor, hasMore };
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
    const names: Names = new Map([[verified.id!, verified.name]]);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize message sequencing and idempotency checks for this thread.
      await tx.$queryRaw`SELECT id FROM "commercial"."communication_threads" WHERE id = ${threadId} FOR UPDATE`;
      const membership = await tx.opsCommunicationParticipant.findFirst({ where: { threadId, actorId: verified.id!, active: true }, select: { id: true } });
      if (!membership) throw new ForbiddenException('Actor is no longer an active thread participant');
      const replay = await tx.opsCommunicationMessage.findUnique({ where: { threadId_idempotencyKey: { threadId, idempotencyKey: input.idempotencyKey } }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      if (replay) {
        if (replay.payloadHash !== payloadHash || replay.senderId !== verified.id) throw new BadRequestException('Idempotency key was already used for a different message');
        return this.safeMessage(replay, names);
      }
      const message = await tx.opsCommunicationMessage.create({ data: { id: `message_${randomUUID()}`, threadId, senderId: verified.id!, senderRole: verified.role, senderEmail: verified.email ?? null, body, payloadHash, idempotencyKey: input.idempotencyKey }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Sent communication message: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'create', category: 'communication', affectedType: 'communication_message', affectedId: message.id, affectedLabel: threadId, metadata: { idempotencyKey: input.idempotencyKey } }, { prisma: tx, actorId: verified.id, correlationId: `communication-message:${message.id}` });
      const [recipients, details] = await Promise.all([
        tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true, actorId: { not: verified.id } }, select: { actorEmail: true } }),
        tx.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { subject: true } }),
      ]);
      const event = await tx.opsEvent.findUnique({ where: { id: thread.eventId }, select: { eventName: true } });
      const notice = newMessageNotice({ senderName: verified.name, senderRole: verified.role, subject: details?.subject ?? 'a conversation', eventName: event?.eventName, body });
      const action = { kind: 'conversation' as const, eventId: thread.eventId, threadId };
      // Email always goes out; the Viber row reaches only people who linked Viber and kept it on, and is skipped for the rest.
      const deliveries = recipients.filter((recipient) => recipient.actorEmail).flatMap((recipient) => (['email', 'viber'] as const).map((channel) => ({ email: recipient.actorEmail!, channel })));
      await Promise.all(deliveries.map(({ email, channel }) => writeNotification(this.notificationOutboxWriter, thread.eventId, email, notice, channel, { idempotencyKey: `communication-message:${message.id}:${channel}:${email}`, action }, { prisma: tx, correlationId: `communication-message:${message.id}` })));
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return this.safeMessage(message, names);
    });
  }

  private async authorizeThread(threadId: string, actor: ResolvedEventOpsActor, resource: string) {
    const thread = await this.prisma.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { id: true, eventId: true } });
    if (!thread) throw new NotFoundException('Communication thread not found');
    await this.access.requireActorRole(actor, readerRoles, resource, thread.eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', thread.eventId);
    return { thread, verified };
  }

  private async ensureMembership(threadId: string, actorId: string) {
    const membership = await this.prisma.opsCommunicationParticipant.findFirst({ where: { threadId, actorId, active: true }, select: { id: true } });
    if (!membership) throw new ForbiddenException('Actor is not an active thread participant');
  }

  /** Display names for everyone taking part in, or quoted by, these conversations. */
  private names(rows: Array<{ participants: Array<{ actorId: string }>; messages: Array<{ senderId: string }> }>, db?: Prisma.TransactionClient): Promise<Names> {
    return this.participants.displayNames(rows.flatMap((row) => [...row.participants.map(({ actorId }) => actorId), ...row.messages.map(({ senderId }) => senderId)]), db);
  }

  private async unreadCounts(rows: Array<Pick<ThreadRow, 'id' | 'participants'>>, actorId: string) {
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
  private safeMessage(message: Pick<MessageRow, 'id' | 'threadId' | 'senderId' | 'senderRole' | 'body' | 'createdAt'>, names: Names) {
    const senderName = names.get(message.senderId);
    return { id: message.id, threadId: message.threadId, senderId: message.senderId, senderRole: message.senderRole, ...(senderName ? { senderName } : {}), body: message.body, createdAt: message.createdAt.toISOString() };
  }

  /** Display names are shared with the whole conversation; each member's read time stays their own. */
  private safeThread(row: ThreadRow | InboxRow, actorId: string, unreadCount: number, names: Names) {
    const messages = row.messages.slice(0, 100);
    const oldest = messages[messages.length - 1];
    const participants = row.participants.map((participant) => {
      const name = names.get(participant.actorId);
      return { id: participant.id, actorId: participant.actorId, actorRole: participant.actorRole, ...(name ? { name } : {}), active: participant.active, ...(participant.actorId === actorId ? { lastReadAt: participant.lastReadAt?.toISOString() ?? null } : {}) };
    });
    return { id: row.id, eventId: row.eventId, subject: row.subject, status: row.status, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), participants, messages: messages.reverse().map((message) => this.safeMessage(message, names)), messagesNextCursor: row.messages.length > 100 && oldest ? encodeCursor({ createdAt: oldest.createdAt.toISOString(), id: oldest.id }) : null, unreadCount };
  }
}
