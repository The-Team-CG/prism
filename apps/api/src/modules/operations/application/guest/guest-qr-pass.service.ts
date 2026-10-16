import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpsGuestQrPass, OpsGuestRosterEntry, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole, AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismGuestQrPassDeliveryStatus, PrismGuestQrPassIssueResult, PrismGuestQrPassStatus } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { GUEST_PASS_DELIVERY_STATUS_READER, type GuestPassDeliveryStatusReader } from '@prism/contexts/read-models/guest-pass-delivery-eligibility';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReference, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import { GuestQrDemoPolicyService } from './guest-qr-demo-policy.service';
import { guestAccessCodeForEvent } from './guest-access-code';
import type { GuestQrPassLifecycleOwner } from '../../contracts/guest-qr-pass-lifecycle.port';
import type { GuestQrPassCommands } from '../../contracts/guest-qr-pass.port';

type GuestQrPassConfigReader = { get(key: string): unknown };
export type GuestQrPassAuditActor = { id?: string; name: string; role: string };
type GuestQrPassTx = Prisma.TransactionClient;
type GuestQrPassRow = Pick<OpsGuestQrPass, 'id' | 'eventId' | 'rosterEntryId' | 'status' | 'deliveryStatus' | 'notificationId' | 'issuedAt' | 'revokedAt'>;

const PMCM_ROLES = new Set<string>([OpsUserRole.PmcmAdmin, OpsUserRole.System]);
const REVIEW_SOURCES = new Set(['guest-review', 'guest-review-headcount', 'coordinator-walk-in']);
const PUBLIC_GUEST_ORIGIN_KEY = 'GUEST_QR_PUBLIC_ORIGIN';
const PASS_INVALIDATION_BATCH_SIZE = 250;

@Injectable()
export class GuestQrPassService implements GuestQrPassCommands, GuestQrPassLifecycleOwner {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(GUEST_PASS_DELIVERY_STATUS_READER) private readonly deliveryStatusReader: GuestPassDeliveryStatusReader,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(ConfigService) private readonly config: GuestQrPassConfigReader,
    private readonly demoPolicy: GuestQrDemoPolicyService,
  ) {}

  isDemoEnabledForEvent(eventId: string): boolean {
    return this.demoPolicy.isEnabledForEvent(eventId);
  }

  async issue(eventId: string, rosterEntryId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    const origin = this.requireGuestOrigin();
    return this.prisma.$transaction(async (tx) => {
      const context = this.context(tx, `guest-qr-issue:${randomUUID()}`);
      const event = await this.requireOpenEvent(eventId, context);
      const roster = await this.requireIssueableRosterEntry(tx, eventId, rosterEntryId);
      await this.requireUniqueActiveEmail(tx, eventId, roster);
      const existing = await tx.opsGuestQrPass.findFirst({
        where: { eventId, rosterEntryId, status: 'active' },
        select: { id: true },
      });
      if (existing) throw new ConflictException('A guest pass already exists; reissue the active pass');
      return this.issuePass(tx, context, event, roster, actor, origin, 'issue');
    }, { isolationLevel: 'Serializable' });
  }

  async reissue(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    const origin = this.requireGuestOrigin();
    return this.prisma.$transaction(async (tx) => {
      const context = this.context(tx, `guest-qr-reissue:${randomUUID()}`);
      const event = await this.requireOpenEvent(eventId, context);
      const current = await this.findPass(tx, eventId, passId);
      if (current.status !== 'active') throw new ConflictException('Only an active guest pass can be reissued');
      const roster = await this.requireIssueableRosterEntry(tx, eventId, current.rosterEntryId);
      await this.requireUniqueActiveEmail(tx, eventId, roster);
      await this.revokePassRecord(tx, current, actor, context, false);
      return this.issuePass(tx, context, event, roster, actor, origin, 'reissue');
    }, { isolationLevel: 'Serializable' });
  }

  async retry(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    return this.prisma.$transaction(async (tx) => {
      const context = this.context(tx, `guest-qr-retry:${randomUUID()}`);
      await this.requireOpenEvent(eventId, context);
      const pass = await this.findPass(tx, eventId, passId);
      if (pass.status !== 'active' || !pass.notificationId) {
        throw new ConflictException('Guest pass delivery cannot be retried; reissue the pass');
      }
      const roster = await this.requireIssueableRosterEntry(tx, eventId, pass.rosterEntryId);
      await this.requireUniqueActiveEmail(tx, eventId, roster);
      const deliveryStatus = await this.currentDeliveryStatus(eventId, pass);
      if (deliveryStatus !== 'queued') {
        throw new ConflictException('Guest pass delivery cannot be retried; reissue the pass');
      }
      await this.notificationOutboxWriter.retryGuestPassDelivery(pass.notificationId, context);
      const updated = await tx.opsGuestQrPass.update({
        where: { id: pass.id },
        data: { deliveryStatus: 'queued' },
      });
      await this.auditPassAction(eventId, roster.id, pass.id, actor, 'retry', context);
      return this.mapStatus(updated, 'queued');
    }, { isolationLevel: 'Serializable' });
  }

  async revoke(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    return this.prisma.$transaction(async (tx) => {
      const context = this.context(tx, `guest-qr-revoke:${randomUUID()}`);
      const pass = await this.findPass(tx, eventId, passId);
      if (pass.status !== 'active') return this.mapStatus(pass, 'revoked');
      await this.revokePassRecord(tx, pass, actor, context, true);
      return this.mapStatus({ ...pass, status: 'revoked', revokedAt: new Date() }, 'revoked');
    }, { isolationLevel: 'Serializable' });
  }

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus[]> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    await this.requireEvent(eventId);
    const passes = await this.prisma.opsGuestQrPass.findMany({
      where: { eventId },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    });
    const deliveryStatuses = await this.deliveryStatusReader.getGuestPassDeliveryStatuses(eventId, passes.map((pass) => pass.id));
    return passes.map((pass) => this.mapStatus(pass, deliveryStatuses.get(pass.id) ?? this.fallbackDeliveryStatus(pass)));
  }

  async get(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus> {
    this.requirePmcm(actor);
    this.requireDemo(eventId);
    await this.requireEvent(eventId);
    const pass = await this.findPass(this.prisma, eventId, passId);
    const deliveryStatus = (await this.deliveryStatusReader.getGuestPassDeliveryStatuses(eventId, [pass.id])).get(pass.id)
      ?? this.fallbackDeliveryStatus(pass);
    return this.mapStatus(pass, deliveryStatus);
  }

  async revokeForRosterEntries(
    eventId: string,
    rosterEntryIds: readonly string[],
    actor: GuestQrPassAuditActor,
    context: PrismTransactionContext,
  ): Promise<void> {
    const uniqueIds = [...new Set(rosterEntryIds)];
    if (uniqueIds.length === 0) return;
    const tx = context.prisma;
    const passes = await tx.opsGuestQrPass.findMany({
      where: { eventId, rosterEntryId: { in: uniqueIds }, status: 'active' },
      orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, eventId: true, rosterEntryId: true, notificationId: true },
    });
    for (const pass of passes) {
      await this.revokePassRecord(tx, pass, actor, context, true);
    }
  }

  async expireEventGuestQrPasses(
    eventId: string,
    reason: 'event-ended' | 'event-archived',
    context: PrismTransactionContext,
  ): Promise<void> {
    void reason;
    const tx = context.prisma;
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each query is capped at 250; revocation removes that batch from the next query.
    while (true) {
      const passes = await tx.opsGuestQrPass.findMany({
        where: { eventId, status: 'active' },
        orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
        take: PASS_INVALIDATION_BATCH_SIZE,
        select: { id: true, eventId: true, rosterEntryId: true, notificationId: true },
      });
      if (passes.length === 0) return;
      for (const pass of passes) {
        await this.revokePassRecord(tx, pass, undefined, context, false);
      }
    }
  }

  private async issuePass(
    tx: GuestQrPassTx,
    context: PrismTransactionContext,
    event: OperationsEventReference,
    roster: OpsGuestRosterEntry,
    actor: ResolvedEventOpsActor,
    origin: string,
    action: 'issue' | 'reissue',
  ): Promise<PrismGuestQrPassIssueResult> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const pass = await tx.opsGuestQrPass.create({
      data: {
        id: `gqp_${randomUUID()}`,
        eventId: event.id,
        rosterEntryId: roster.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        status: 'active',
        deliveryStatus: 'queued',
        issuedById: actor.id ?? 'system',
        issuedAt: now,
      },
    });
    const qrValue = this.buildQrValue(origin, event, token);
    const delivery = await this.notificationOutboxWriter.writeGuestPassDelivery({
      eventId: event.id,
      passId: pass.id,
      recipient: this.normalizeEmail(roster.email),
      plaintextMessage: `Your guest check-in pass is ready. Open this link on your phone: ${qrValue}`,
      idempotencyKey: `guest-qr-pass:${pass.id}:delivery`,
    }, context);
    const saved = await tx.opsGuestQrPass.update({
      where: { id: pass.id },
      data: { notificationId: delivery.notificationId, deliveryStatus: 'queued' },
    });
    await this.auditPassAction(event.id, roster.id, pass.id, actor, action, context);
    return { pass: this.mapStatus(saved, 'queued'), qrValue };
  }

  private async requireOpenEvent(eventId: string, context: PrismTransactionContext) {
    const event = await this.requireEvent(eventId, context);
    if (event.actualEndedAt !== null || event.archived || event.status === 'archived') {
      throw new ConflictException('Guest QR passes are unavailable for this event');
    }
    return event;
  }

  private async requireEvent(eventId: string, context?: PrismTransactionContext) {
    const event = await this.eventReferences.findOperationsEvent(eventId, context);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireIssueableRosterEntry(tx: GuestQrPassTx, eventId: string, rosterEntryId: string) {
    const roster = await tx.opsGuestRosterEntry.findFirst({ where: { id: rosterEntryId, eventId } });
    if (!roster) throw new NotFoundException('Roster entry not found');
    const source = roster.source.trim().toLowerCase();
    if (!roster.importBatchId?.trim()
      || !source
      || REVIEW_SOURCES.has(source)
      || roster.withdrawnAt !== null
      || roster.eligibility !== 'eligible'
      || roster.verificationStatus === 'rejected'
      || !this.normalizeEmail(roster.email)) {
      throw new BadRequestException('Guest QR passes require an imported, active, eligible roster entry with an email');
    }
    return roster;
  }

  private async requireUniqueActiveEmail(tx: GuestQrPassTx, eventId: string, roster: OpsGuestRosterEntry) {
    const email = this.normalizeEmail(roster.email);
    const matches = await tx.opsGuestRosterEntry.findMany({
      // contains finds legacy rows with surrounding whitespace; compare normalized values below.
      where: { eventId, withdrawnAt: null, email: { contains: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (matches.some((row) => row.id !== roster.id && this.normalizeEmail(row.email) === email)) {
      throw new ConflictException('Guest email must belong to exactly one active roster entry');
    }
  }

  private async findPass(tx: Pick<PrismaService, 'opsGuestQrPass'> | GuestPassTxLike, eventId: string, passId: string) {
    const pass = await tx.opsGuestQrPass.findFirst({ where: { id: passId, eventId } });
    if (!pass) throw new NotFoundException('Guest pass not found');
    return pass;
  }

  private async currentDeliveryStatus(eventId: string, pass: GuestQrPassRow): Promise<PrismGuestQrPassDeliveryStatus> {
    return (await this.deliveryStatusReader.getGuestPassDeliveryStatuses(eventId, [pass.id])).get(pass.id)
      ?? this.fallbackDeliveryStatus(pass);
  }

  private async revokePassRecord(
    tx: Pick<PrismaService, 'opsGuestQrPass'> | GuestPassTxLike,
    pass: Pick<OpsGuestQrPass, 'id' | 'eventId' | 'rosterEntryId' | 'notificationId'>,
    actor: GuestQrPassAuditActor | undefined,
    context: PrismTransactionContext,
    audit: boolean,
  ) {
    const revokedAt = new Date();
    const updated = await tx.opsGuestQrPass.updateMany({
      where: { id: pass.id, status: 'active' },
      data: { status: 'revoked', deliveryStatus: 'revoked', revokedAt, revokedById: actor?.id ?? null },
    });
    if (updated.count !== 1) return false;
    if (pass.notificationId) await this.notificationOutboxWriter.cancelGuestPassDelivery(pass.notificationId, context);
    if (audit && actor) await this.auditPassAction(pass.eventId, pass.rosterEntryId, pass.id, actor, 'revoke', context);
    return true;
  }

  private async auditPassAction(
    eventId: string,
    rosterEntryId: string,
    passId: string,
    actor: GuestQrPassAuditActor,
    action: 'issue' | 'retry' | 'reissue' | 'revoke',
    context: PrismTransactionContext,
  ) {
    await writeAudit(this.auditWriter, eventId, actor.name, `Guest QR pass ${action}`, {
      actorRole: actor.role,
      category: AuditCategory.Events,
      actionType: action === 'issue' ? AuditActionType.Create : AuditActionType.Update,
      affectedType: 'guest_qr_pass',
      affectedId: passId,
      metadata: { actorId: actor.id ?? null, rosterEntryId, action },
    }, { ...context, actorId: actor.id });
  }

  private mapStatus(
    pass: Pick<OpsGuestQrPass, 'id' | 'eventId' | 'rosterEntryId' | 'status' | 'issuedAt' | 'revokedAt'>,
    deliveryStatus: PrismGuestQrPassDeliveryStatus,
  ): PrismGuestQrPassStatus {
    return {
      id: pass.id,
      eventId: pass.eventId,
      rosterEntryId: pass.rosterEntryId,
      status: pass.status === 'active' ? 'active' : 'revoked',
      deliveryStatus: pass.status === 'active' ? deliveryStatus : 'revoked',
      issuedAt: pass.issuedAt.toISOString(),
      revokedAt: pass.revokedAt?.toISOString() ?? null,
    };
  }

  private fallbackDeliveryStatus(pass: Pick<OpsGuestQrPass, 'status' | 'deliveryStatus'>): PrismGuestQrPassDeliveryStatus {
    if (pass.status !== 'active') return 'revoked';
    if (pass.deliveryStatus === 'captured' || pass.deliveryStatus === 'failed') return pass.deliveryStatus;
    return 'queued';
  }

  private buildQrValue(origin: string, event: OperationsEventReference, token: string) {
    const url = new URL(`/check-in/${encodeURIComponent(guestAccessCodeForEvent(event))}`, origin);
    url.hash = `pass=${token}`;
    return url.toString();
  }

  private requireGuestOrigin() {
    const configured = this.config.get(PUBLIC_GUEST_ORIGIN_KEY);
    if (typeof configured !== 'string' || !configured.trim()) {
      throw new ServiceUnavailableException('Guest QR passes are unavailable');
    }
    try {
      const origin = new URL(configured.trim());
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
        throw new Error('Invalid guest origin');
      }
      return origin.origin;
    } catch {
      throw new ServiceUnavailableException('Guest QR passes are unavailable');
    }
  }

  private normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() ?? '';
  }

  private requireDemo(eventId: string) {
    if (!this.demoPolicy.isEnabledForEvent(eventId)) {
      throw new ServiceUnavailableException('Guest QR passes are unavailable');
    }
  }

  private requirePmcm(actor: ResolvedEventOpsActor) {
    if (!PMCM_ROLES.has(actor.role)) throw new ForbiddenException('Only PMCM Admin or System may manage guest QR passes');
  }

  private context(tx: Prisma.TransactionClient, correlationId: string): PrismTransactionContext {
    return { prisma: tx, correlationId };
  }
}

type GuestPassTxLike = Pick<PrismaService, 'opsGuestQrPass' | 'opsGuestRosterEntry'>;
