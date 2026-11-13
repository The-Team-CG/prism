import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { AddCommunicationParticipantsInput, CommunicationInboxQuery, CommunicationThreadStatus, CommunicationThreadsQuery, CommunicationUnreadCountQuery, CreateCommunicationThreadInput, PrismCommunicationInboxThread, PrismCommunicationReadReceipt, PrismCommunicationUnreadCount, PrismCursorPage, SendCommunicationMessageInput, UpdateCommunicationThreadStatusInput } from '@prism/types';
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
const readerRoles = [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator];
const ROLE_LABELS: Record<string, string> = { [OpsUserRole.PmcmAdmin]: 'PMCM', [OpsUserRole.System]: 'PMCM', [OpsUserRole.Client]: 'Client', [OpsUserRole.Supplier]: 'Supplier', [OpsUserRole.Coordinator]: 'Coordinator' };
const PREVIEW_LENGTH = 140;
/** The only roles that may change who is in a conversation or whether it is closed. */
const PMCM_ROLES: readonly string[] = [OpsUserRole.PmcmAdmin, OpsUserRole.System];

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
/** Keyset position in the conversation list: the last row shown, by activity then id. */
type ThreadCursor = { updatedAt: string; id: string };
type ThreadPageScope = { actorId: string; eventIds: string[] };
type ThreadPageQuery = { cursor?: string; limit: number; q?: string; status: CommunicationThreadStatus };
function encodeThreadCursor(row: { updatedAt: Date; id: string }) { return Buffer.from(JSON.stringify({ updatedAt: row.updatedAt.toISOString(), id: row.id }), 'utf8').toString('base64url'); }
function decodeThreadCursor(value?: string): ThreadCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ThreadCursor>;
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string' || Number.isNaN(new Date(parsed.updatedAt).getTime())) throw new Error('invalid');
    return { updatedAt: new Date(parsed.updatedAt).toISOString(), id: parsed.id };
  } catch { throw new BadRequestException('Invalid communication thread cursor'); }
}
function portalFor(role: string) {
  return role === OpsUserRole.Coordinator ? 'coordinator' : role === OpsUserRole.Client ? 'client' : role === OpsUserRole.Supplier ? 'supplier' : 'event';
}
function threadStatus(value: string): CommunicationThreadStatus { return value === 'closed' ? 'closed' : 'open'; }
/** Refuses a change that would leave fewer than two members, or no PMCM member, in the conversation. */
function assertMembershipAllowed(remaining: Array<{ actorRole: string }>) {
  if (remaining.length < 2) throw new BadRequestException('A conversation needs at least two members');
  if (!remaining.some((member) => PMCM_ROLES.includes(member.actorRole))) throw new BadRequestException('A conversation needs a PMCM member');
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
      return this.threadView(tx, thread.id, actor.id!);
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

  /** One page of the conversations in one event, most recent activity first, optionally filtered by status and search. */
  async listThreads(query: CommunicationThreadsQuery, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, readerRoles, 'communication threads', query.eventId);
    const verified = await this.participants.resolveForEvent(actor.id ?? '', query.eventId);
    const page = await this.threadPage({ actorId: verified.id!, eventIds: [query.eventId] }, query, 101);
    const [unreadByThread, names] = await Promise.all([this.unreadCounts(page.items, verified.id!), this.names(page.items)]);
    return { items: page.items.map((row) => this.safeThread(row, verified.id!, unreadByThread.get(row.id) ?? 0, names)), limit: query.limit, nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  /** One conversation the account is a member of, read the same way as its messages. */
  async getThread(threadId: string, actor: ResolvedEventOpsActor) {
    const { verified } = await this.authorizeThread(threadId, actor, 'communication thread');
    await this.ensureMembership(threadId, verified.id!);
    const row = await this.thread(this.prisma, threadId);
    if (!row) throw new NotFoundException('Communication thread not found');
    const unreadByThread = await this.unreadCounts([row], verified.id!);
    return this.safeThread(row, verified.id!, unreadByThread.get(row.id) ?? 0, await this.names([row]));
  }

  /**
   * One page of every conversation the account is in, across the events it can still read, most recent activity first.
   * The readable events are resolved before paging, so an unreadable event never shortens a page.
   */
  async listInbox(query: CommunicationInboxQuery, actor: ResolvedEventOpsActor): Promise<PrismCursorPage<PrismCommunicationInboxThread>> {
    await this.access.requireActorRole(actor, readerRoles, 'communication inbox');
    if (!actor.id) throw new BadRequestException('The inbox requires a verified account');
    const actorId = actor.id;
    const page = await this.threadPage({ actorId, eventIds: await this.readableEventIdsFor(actorId) }, query, 1);
    const visible = page.items;
    const [events, unreadByThread, names] = await Promise.all([
      this.prisma.opsEvent.findMany({ where: { id: { in: [...new Set(visible.map((row) => row.eventId))] } }, select: { id: true, eventName: true } }),
      this.unreadCounts(visible, actorId),
      this.names(visible),
    ]);
    const eventNames = new Map(events.map((event) => [event.id, event.eventName]));
    const items = visible.map((row) => {
      const { messages, messagesNextCursor: _history, ...thread } = this.safeThread(row, actorId, unreadByThread.get(row.id) ?? 0, names);
      return { ...thread, eventName: eventNames.get(row.eventId) ?? '', lastMessage: messages[0] ?? null };
    });
    return { items, limit: query.limit, nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  /**
   * Unread messages for the inbox, or for one event's conversations when `eventId` is given. Both use the inbox's
   * membership and read rule, with no message bodies loaded. An event the account cannot read is refused (403),
   * as `listThreads` refuses it.
   */
  async unreadCount(query: CommunicationUnreadCountQuery, actor: ResolvedEventOpsActor): Promise<PrismCommunicationUnreadCount> {
    await this.access.requireActorRole(actor, readerRoles, 'communication unread count', query.eventId);
    if (!actor.id) throw new BadRequestException('The inbox requires a verified account');
    const actorId = actor.id;
    if (query.eventId) await this.participants.resolveForEvent(actorId, query.eventId);
    // A closed conversation is finished: it stops counting toward the navigation badge. Every open conversation is counted, with no cap.
    const rows = await this.prisma.opsCommunicationThread.findMany({ where: { participants: { some: { actorId, active: true } }, status: 'open', eventId: query.eventId }, select: { id: true, eventId: true, participants: { where: { active: true }, select: participantSelect } } });
    const readable = await this.participants.readableEventIds(actorId, rows.map((row) => row.eventId));
    const counts = await this.unreadCounts(rows.filter((row) => readable.has(row.eventId)), actorId);
    return { unread: [...counts.values()].reduce((sum, count) => sum + count, 0) };
  }

  /** Events where the account is an active member and may still read: the set the inbox and search are limited to. */
  private async readableEventIdsFor(actorId: string): Promise<string[]> {
    const memberships = await this.prisma.opsCommunicationThread.findMany({ where: { participants: { some: { actorId, active: true } } }, distinct: ['eventId'], select: { eventId: true } });
    // Membership alone is not access: a cancelled booking or a locked portal hides that event's conversations too.
    return [...await this.participants.readableEventIds(actorId, memberships.map((row) => row.eventId))];
  }

  /** Keyset page of the account's conversations in `scope.eventIds`. Membership and the event scope always apply first. */
  private async threadPage(scope: ThreadPageScope, query: ThreadPageQuery, messagesTake: number) {
    const cursor = decodeThreadCursor(query.cursor);
    const where = await this.threadPageWhere(scope, query, cursor);
    const rows = await this.prisma.opsCommunicationThread.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: limit is 1-50 by the query schema, plus one to detect the next page.
      take: query.limit + 1,
      select: { ...threadFields, participants: { where: { active: true }, select: participantSelect }, messages: { take: messagesTake, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } },
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return { items, hasMore, nextCursor: hasMore && last ? encodeThreadCursor(last) : null };
  }

  private async threadPageWhere({ actorId, eventIds }: ThreadPageScope, query: ThreadPageQuery, cursor?: ThreadCursor): Promise<Prisma.OpsCommunicationThreadWhereInput> {
    const where: Prisma.OpsCommunicationThreadWhereInput = { participants: { some: { actorId, active: true } }, eventId: { in: eventIds }, status: query.status };
    if (query.q) where.OR = await this.searchClauses(eventIds, query.q);
    if (cursor) {
      const updatedAt = new Date(cursor.updatedAt);
      where.AND = [{ OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: cursor.id } }] }];
    }
    return where;
  }

  /** A conversation matches when its subject, its event's name, or any of its messages contains the text. */
  private async searchClauses(eventIds: string[], q: string): Promise<Prisma.OpsCommunicationThreadWhereInput[]> {
    const events = await this.prisma.opsEvent.findMany({ where: { id: { in: eventIds }, eventName: { contains: q, mode: 'insensitive' } }, select: { id: true } });
    return [
      { subject: { contains: q, mode: 'insensitive' } },
      { eventId: { in: events.map((event) => event.id) } },
      { messages: { some: { body: { contains: q, mode: 'insensitive' } } } },
    ];
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

  async readReceipts(threadId: string, actor: ResolvedEventOpsActor): Promise<PrismCommunicationReadReceipt[]> {
    if (actor.role !== OpsUserRole.PmcmAdmin) throw new ForbiddenException('Only PMCM can inspect conversation read receipts');
    const { verified } = await this.authorizeThread(threadId, actor, 'communication read receipts');
    if (verified.role !== OpsUserRole.PmcmAdmin) throw new ForbiddenException('Only PMCM can inspect conversation read receipts');
    await this.ensureMembership(threadId, verified.id!);
    const rows = await this.prisma.opsCommunicationParticipant.findMany({ where: { threadId, active: true }, select: { actorId: true, lastReadAt: true }, orderBy: { actorId: 'asc' }, take: 200 });
    const names = await this.participants.displayNames(rows.map((row) => row.actorId));
    return rows.map((row) => ({ actorId: row.actorId, name: names.get(row.actorId), lastReadAt: row.lastReadAt?.toISOString() ?? null }));
  }

  async sendMessage(threadId: string, input: SendCommunicationMessageInput, actor: ResolvedEventOpsActor) {
    const { thread, verified } = await this.authorizeThread(threadId, actor, 'communication message');
    const body = input.body.trim();
    const payloadHash = createHash('sha256').update(JSON.stringify({ threadId, senderId: verified.id, body })).digest('hex');
    const names: Names = new Map([[verified.id!, verified.name]]);
    return this.prisma.$transaction(async (tx) => {
      await this.lockThread(tx, threadId);
      const membership = await tx.opsCommunicationParticipant.findFirst({ where: { threadId, actorId: verified.id!, active: true }, select: { id: true } });
      if (!membership) throw new ForbiddenException('Actor is no longer an active thread participant');
      const replay = await tx.opsCommunicationMessage.findUnique({ where: { threadId_idempotencyKey: { threadId, idempotencyKey: input.idempotencyKey } }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      if (replay) {
        if (replay.payloadHash !== payloadHash || replay.senderId !== verified.id) throw new BadRequestException('Idempotency key was already used for a different message');
        return this.safeMessage(replay, names);
      }
      await this.assertOpen(tx, threadId);
      const message = await tx.opsCommunicationMessage.create({ data: { id: `message_${randomUUID()}`, threadId, senderId: verified.id!, senderRole: verified.role, senderEmail: verified.email ?? null, body, payloadHash, idempotencyKey: input.idempotencyKey }, select: { id: true, threadId: true, senderId: true, senderRole: true, body: true, payloadHash: true, createdAt: true } });
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Sent communication message: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'create', category: 'communication', affectedType: 'communication_message', affectedId: message.id, affectedLabel: threadId, metadata: { idempotencyKey: input.idempotencyKey } }, { prisma: tx, actorId: verified.id, correlationId: `communication-message:${message.id}` });
      const [recipients, details] = await Promise.all([
        tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true, actorId: { not: verified.id } }, select: { actorEmail: true, actorRole: true } }),
        tx.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { subject: true } }),
      ]);
      const event = await tx.opsEvent.findUnique({ where: { id: thread.eventId }, select: { eventName: true } });
      const notice = newMessageNotice({ senderName: verified.name, senderRole: verified.role, subject: details?.subject ?? 'a conversation', eventName: event?.eventName, body });
      // Email always goes out; the Viber row reaches only people who linked Viber and kept it on, and is skipped for the rest.
      const deliveries = recipients.filter((recipient) => recipient.actorEmail).flatMap((recipient) => (['email', 'viber'] as const).map((channel) => ({ email: recipient.actorEmail!, role: recipient.actorRole, channel })));
      await Promise.all(deliveries.map(({ email, role, channel }) => {
        return writeNotification(this.notificationOutboxWriter, thread.eventId, email, notice, channel, { idempotencyKey: `communication-message:${message.id}:${channel}:${email}`, action: { kind: 'conversation', eventId: thread.eventId, threadId, portal: portalFor(role) } }, { prisma: tx, correlationId: `communication-message:${message.id}` });
      }));
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return this.safeMessage(message, names);
    });
  }

  /** PMCM adds eligible people to a conversation. A removed member is reactivated, and sees the whole history again. */
  async addParticipants(threadId: string, input: AddCommunicationParticipantsInput, actor: ResolvedEventOpsActor) {
    const { thread, verified } = await this.authorizeManager(threadId, actor, 'add communication participants');
    const eligible = new Map((await this.participants.listEligibleForEvent(thread.eventId, verified)).map((person) => [person.id, person]));
    const people = input.actorIds.map((id) => {
      const person = eligible.get(id);
      if (!person) throw new BadRequestException('Only people eligible for this event can join the conversation');
      return person;
    });
    const batchId = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      await this.lockThread(tx, threadId);
      const current = await tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true, actorId: { in: input.actorIds } }, select: { actorId: true } });
      if (current.length) throw new BadRequestException('Someone chosen is already in this conversation');
      // Joining starts read: the history stays visible, but only messages sent after this moment count as unread.
      const joinedAt = new Date();
      await Promise.all(/* QUERY_AUDIT_ALLOW_BOUNDED_LOOP: the request schema allows at most 20 people, so this is one small batch. */ people.map((person) => tx.opsCommunicationParticipant.upsert({
        where: { threadId_actorId: { threadId, actorId: person.id } },
        create: { id: `participant_${randomUUID()}`, threadId, actorId: person.id, actorRole: person.role, actorEmail: person.email || null, lastReadAt: joinedAt, addedAt: joinedAt },
        update: { active: true, actorRole: person.role, actorEmail: person.email || null, lastReadAt: joinedAt, addedAt: joinedAt },
      })));
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Added communication participants: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'create', category: 'communication', affectedType: 'communication_thread', affectedId: threadId, affectedLabel: thread.subject, metadata: { addedActorIds: input.actorIds } }, { prisma: tx, actorId: verified.id, correlationId: `communication-participants:${batchId}` });
      await this.queueJoinNotices(tx, { eventId: thread.eventId, threadId, subject: thread.subject, batchId, sender: verified.name, people });
      return this.threadView(tx, threadId, verified.id!);
    });
  }

  /** PMCM removes a member: they lose access at once. The conversation keeps at least two members and one PMCM member. */
  async removeParticipant(threadId: string, removedActorId: string, actor: ResolvedEventOpsActor) {
    const { thread, verified } = await this.authorizeManager(threadId, actor, 'remove communication participant');
    return this.prisma.$transaction(async (tx) => {
      await this.lockThread(tx, threadId);
      const members = await tx.opsCommunicationParticipant.findMany({ where: { threadId, active: true }, select: { actorId: true, actorRole: true } });
      if (!members.some((member) => member.actorId === removedActorId)) throw new NotFoundException('That person is not in this conversation');
      assertMembershipAllowed(members.filter((member) => member.actorId !== removedActorId));
      await tx.opsCommunicationParticipant.update({ where: { threadId_actorId: { threadId, actorId: removedActorId } }, data: { active: false } });
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `Removed communication participant: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'delete', category: 'communication', affectedType: 'communication_thread', affectedId: threadId, affectedLabel: thread.subject, metadata: { removedActorId } }, { prisma: tx, actorId: verified.id, correlationId: `communication-participant:${threadId}:${removedActorId}` });
      return this.threadView(tx, threadId, verified.id!);
    });
  }

  /** PMCM closes a finished conversation, or reopens it. */
  async setStatus(threadId: string, input: UpdateCommunicationThreadStatusInput, actor: ResolvedEventOpsActor) {
    const { thread, verified } = await this.authorizeManager(threadId, actor, 'communication thread status');
    return this.prisma.$transaction(async (tx) => {
      await this.lockThread(tx, threadId);
      await tx.opsCommunicationThread.update({ where: { id: threadId }, data: { status: input.status } });
      const verb = input.status === 'closed' ? 'Closed' : 'Reopened';
      await writeAudit(this.auditWriter, thread.eventId, verified.name, `${verb} communication thread: ${threadId}`, { actorRole: verified.role, actorEmail: verified.email, actionType: 'update', category: 'communication', affectedType: 'communication_thread', affectedId: threadId, affectedLabel: thread.subject, metadata: { status: input.status } }, { prisma: tx, actorId: verified.id, correlationId: `communication-thread-status:${threadId}:${input.status}` });
      return this.threadView(tx, threadId, verified.id!);
    });
  }

  /** Tells each added person, on the channels a message uses, that they were added and where the conversation is. */
  private async queueJoinNotices(tx: Prisma.TransactionClient, join: { eventId: string; threadId: string; subject: string; batchId: string; sender: string; people: Array<{ id: string; email: string; role: string }> }) {
    const event = await tx.opsEvent.findUnique({ where: { id: join.eventId }, select: { eventName: true } });
    const where = event?.eventName ? ` for ${event.eventName}` : '';
    const notice = `${join.sender} added you to "${join.subject}"${where}. You will see earlier messages in this conversation.`;
    const deliveries = join.people.filter((person) => person.email).flatMap((person) => (['email', 'viber'] as const).map((channel) => ({ person, channel })));
    await Promise.all(deliveries.map(({ person, channel }) => writeNotification(this.notificationOutboxWriter, join.eventId, person.email, notice, channel, { idempotencyKey: `communication-join:${join.batchId}:${channel}:${person.email}`, action: { kind: 'conversation', eventId: join.eventId, threadId: join.threadId, portal: portalFor(person.role) } }, { prisma: tx, correlationId: `communication-join:${join.batchId}` })));
  }

  /** Membership and status changes run under the thread row lock, so they serialize with message sends. */
  private lockThread(tx: Prisma.TransactionClient, threadId: string) {
    // QUERY_AUDIT_RAW_SQL: serialize message sequencing, membership and status changes for this thread.
    return tx.$queryRaw`SELECT id FROM "commercial"."communication_threads" WHERE id = ${threadId} FOR UPDATE`;
  }

  private async assertOpen(tx: Prisma.TransactionClient, threadId: string) {
    const row = await tx.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { status: true } });
    if (row && threadStatus(row.status) === 'closed') throw new ConflictException('This conversation is closed');
  }

  private async threadView(db: PrismaService | Prisma.TransactionClient, threadId: string, actorId: string) {
    const row = await this.thread(db, threadId);
    return row ? this.safeThread(row, actorId, 0, await this.names([row], db)) : row;
  }

  private async authorizeManager(threadId: string, actor: ResolvedEventOpsActor, resource: string) {
    const scope = await this.authorizeThread(threadId, actor, resource);
    if (!PMCM_ROLES.includes(scope.verified.role)) throw new ForbiddenException('Only PMCM can change conversation members or status');
    // A PMCM admin can read a conversation only as a member, so managing one requires the same membership as reading it.
    await this.ensureMembership(threadId, scope.verified.id!);
    return scope;
  }

  private async authorizeThread(threadId: string, actor: ResolvedEventOpsActor, resource: string) {
    const thread = await this.prisma.opsCommunicationThread.findUnique({ where: { id: threadId }, select: { id: true, eventId: true, subject: true } });
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

  /** Unread counts for the given conversations in one grouped query: someone else's message newer than this account's read time. */
  private async unreadCounts(rows: Array<Pick<ThreadRow, 'id' | 'participants'>>, actorId: string): Promise<Map<string, number>> {
    const readAt = new Map(rows.map((row) => [row.id, row.participants.find((participant) => participant.actorId === actorId)?.lastReadAt ?? null]));
    if (!readAt.size) return new Map();
    const groups = await this.prisma.opsCommunicationMessage.groupBy({
      by: ['threadId'],
      where: { senderId: { not: actorId }, OR: [...readAt].map(([threadId, lastRead]) => (lastRead ? { threadId, createdAt: { gt: lastRead } } : { threadId })) },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.threadId, group._count._all]));
  }

  private thread(db: PrismaService | Prisma.TransactionClient, id: string) {
    return db.opsCommunicationThread.findUnique({ where: { id }, select: { id: true, eventId: true, subject: true, status: true, createdBy: true, createdAt: true, updatedAt: true, participants: { where: { active: true }, select: participantSelect }, messages: { take: 101, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageSelect } } });
  }
  private safeMessage(message: Pick<MessageRow, 'id' | 'threadId' | 'senderId' | 'senderRole' | 'body' | 'createdAt'>, names: Names) {
    const senderName = names.get(message.senderId);
    return { id: message.id, threadId: message.threadId, senderId: message.senderId, senderRole: message.senderRole, ...(senderName ? { senderName } : {}), body: message.body, createdAt: message.createdAt.toISOString() };
  }

  /** Other members' read times are available only through the PMCM-authorized receipts endpoint. */
  private safeThread(row: ThreadRow | InboxRow, actorId: string, unreadCount: number, names: Names) {
    const messages = row.messages.slice(0, 100);
    const oldest = messages[messages.length - 1];
    const participants = row.participants.map((participant) => {
      const name = names.get(participant.actorId);
      return { id: participant.id, actorId: participant.actorId, actorRole: participant.actorRole, ...(name ? { name } : {}), active: participant.active, ...(participant.actorId === actorId ? { lastReadAt: participant.lastReadAt?.toISOString() ?? null } : {}) };
    });
    return { id: row.id, eventId: row.eventId, subject: row.subject, status: threadStatus(row.status), createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), participants, messages: messages.reverse().map((message) => this.safeMessage(message, names)), messagesNextCursor: row.messages.length > 100 && oldest ? encodeCursor({ createdAt: oldest.createdAt.toISOString(), id: oldest.id }) : null, unreadCount };
  }
}
