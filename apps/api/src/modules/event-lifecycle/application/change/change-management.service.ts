import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { DecideFreezeExceptionInput, FreezeEventInput, IssueAddendumInput, RequestFreezeExceptionInput, PrismAddendum, PrismClientChangeRequest, PrismEventFreezeException } from '@prism/types';
import { randomUUID } from 'node:crypto';
import { mapAddendum, presentAddendumFor } from './addendum.mappers';
import { COMMERCIAL_ADDENDUM_IMPACT_WRITER, type CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import { consumeApprovedFreezeException } from './freeze-exception-consumption';
import { PRISM_BUSINESS_UTC_OFFSET_HOURS } from '@prism/types';
import { AUTO_FREEZE_DAYS_BEFORE_EVENT, isDueForAutomaticFreeze } from '../../domain/auto-freeze.policy';
import { CLIENT_CHANGE_REQUEST_SELECT, toClientChangeRequest } from '../../domain/client-change-request.projection';

type SnapshotEntry = Record<string, unknown>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function entryKey(entry: SnapshotEntry) {
  return String(entry.id ?? entry.key ?? entry.code ?? stable(entry));
}

export function compareSnapshots(previous: SnapshotEntry[], next: SnapshotEntry[]) {
  const before = new Map(previous.map((entry) => [entryKey(entry), entry]));
  const after = new Map(next.map((entry) => [entryKey(entry), entry]));
  return [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a.localeCompare(b)).flatMap((key) => {
    const oldValue = before.get(key) ?? null;
    const newValue = after.get(key) ?? null;
    return stable(oldValue) === stable(newValue) ? [] : [{ key, before: oldValue, after: newValue }];
  });
}

function mapException(value: { id: string; eventId: string; requestedChange: string; reason: string; status: string; requestedBy: string; decidedBy: string | null; decisionNote: string | null; requestedAt: Date; decidedAt: Date | null; consumedAt: Date | null }): PrismEventFreezeException {
  // Explicit fields: the Prisma row also carries internal columns that must not reach the response.
  return {
    id: value.id,
    eventId: value.eventId,
    requestedChange: value.requestedChange,
    reason: value.reason,
    status: value.status as PrismEventFreezeException['status'],
    requestedBy: value.requestedBy,
    decidedBy: value.decidedBy,
    decisionNote: value.decisionNote,
    requestedAt: value.requestedAt.toISOString(),
    decidedAt: value.decidedAt?.toISOString() ?? null,
    consumedAt: value.consumedAt?.toISOString() ?? null,
  };
}

/** Quote amounts that the comparison says changed. Quotes whose amount did not change are not planned. */
function quotePriceChangesOf(quoteChanges: ReturnType<typeof compareSnapshots>) {
  return quoteChanges.flatMap((change) => {
    const before = change.before as SnapshotEntry | null;
    const after = change.after as SnapshotEntry | null;
    const quoteId = String(after?.id ?? before?.id ?? '');
    const amount = typeof after?.amount === 'number' ? after.amount : null;
    return quoteId && amount !== null ? [{ quoteId, amount }] : [];
  });
}

@Injectable()
export class ChangeManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(COMMERCIAL_ADDENDUM_IMPACT_WRITER) private readonly commercialAddendumImpactWriter: CommercialAddendumImpactWriter,
  ) {}

  private async requireOperator(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
  }

  async freezeEvent(eventId: string, input: FreezeEventInput, actor: ResolvedEventOpsActor) {
    await this.requireOperator(actor, eventId, 'event freeze');
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived) throw new BadRequestException('Archived events cannot be frozen');
      const freezeDeadlineAt = input.deadline ? new Date(input.deadline) : event.eventDate;
      const updated = await tx.opsEvent.update({ where: { id: eventId }, data: { freezeStatus: 'frozen', freezeAt: new Date(), freezeDeadlineAt, freezeReason: input.reason.trim() } });
      await writeAudit(this.audit, eventId, actor.name, 'Froze event scope', { actorRole: actor.role, actionType: 'update', category: 'events', affectedType: 'event_freeze', affectedId: eventId, metadata: { reason: input.reason.trim(), previousStatus: event.freezeStatus } }, { prisma: tx, correlationId: eventId, actorId: actor.id });
      return { eventId: updated.id, freezeStatus: updated.freezeStatus, freezeAt: updated.freezeAt?.toISOString() ?? null, freezeDeadlineAt: updated.freezeDeadlineAt?.toISOString() ?? null, freezeReason: updated.freezeReason };
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * Freezes every open, live event that has reached five days before its event day. Each event is frozen in its own
   * transaction and only if it is still open, so a manual freeze that lands first, or a repeat sweep, changes nothing.
   */
  async freezeEventsDue(now = new Date()) {
    const dayMs = 24 * 60 * 60 * 1000;
    const candidates = await this.prisma.opsEvent.findMany({
      where: {
        archived: false,
        freezeStatus: 'open',
        actualEndedAt: null,
        eventDate: { lte: new Date(now.getTime() + AUTO_FREEZE_DAYS_BEFORE_EVENT * dayMs + PRISM_BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000), gt: new Date(now.getTime() - dayMs) },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const reason = `Automatic scope freeze ${AUTO_FREEZE_DAYS_BEFORE_EVENT} days before the event`;
    let frozen = 0;
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: the event query above caps each sweep at 100 rows.
    for (const event of candidates) {
      if (!isDueForAutomaticFreeze(event, now)) continue;
      try {
        const changed = await this.prisma.$transaction(async (tx) => {
          const result = await tx.opsEvent.updateMany({
            where: { id: event.id, freezeStatus: 'open', archived: false },
            data: { freezeStatus: 'frozen', freezeAt: now, freezeDeadlineAt: event.eventDate, freezeReason: reason },
          });
          if (result.count !== 1) return false;
          await writeAudit(this.audit, event.id, 'System', 'Froze event scope automatically', { actorRole: OpsUserRole.System, actionType: 'update', category: 'events', affectedType: 'event_freeze', affectedId: event.id, metadata: { reason, automatic: true, daysBeforeEvent: AUTO_FREEZE_DAYS_BEFORE_EVENT } }, { prisma: tx, correlationId: `auto-freeze:${event.id}` });
          return true;
        });
        if (changed) frozen += 1;
      } catch { /* one event's failure leaves it open for the next sweep and does not stop the others */ }
    }
    return { frozen };
  }

  async requestException(eventId: string, input: RequestFreezeExceptionInput, actor: ResolvedEventOpsActor): Promise<PrismEventFreezeException> {
    await this.requireOperator(actor, eventId, 'freeze exception');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, freezeStatus: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.freezeStatus !== 'frozen') throw new BadRequestException('Freeze exceptions are only required after an event is frozen');
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.opsEventFreezeException.create({ data: { id: `freeze_ex_${randomUUID()}`, eventId, requestedChange: input.requestedChange.trim(), reason: input.reason.trim(), requestedBy: actor.name } });
      await writeAudit(this.audit, eventId, actor.name, 'Requested event freeze exception', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'freeze_exception', affectedId: value.id, metadata: { requestedChange: value.requestedChange, reason: value.reason } }, { prisma: tx, correlationId: value.id, actorId: actor.id });
      return mapException(value);
    });
  }

  async decideException(eventId: string, exceptionId: string, input: DecideFreezeExceptionInput, actor: ResolvedEventOpsActor): Promise<PrismEventFreezeException> {
    await this.requireOperator(actor, eventId, 'freeze exception decision');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.opsEventFreezeException.findFirst({ where: { id: exceptionId, eventId } });
      if (!existing) throw new NotFoundException('Freeze exception not found');
      if (existing.status !== 'pending') throw new BadRequestException('Freeze exception has already been decided');
      const value = await tx.opsEventFreezeException.update({ where: { id: exceptionId }, data: { status: input.decision === 'approve' ? 'approved' : 'rejected', decidedBy: actor.name, decisionNote: input.decisionNote?.trim() ?? null, decidedAt: new Date() } });
      await writeAudit(this.audit, eventId, actor.name, `${input.decision === 'approve' ? 'Approved' : 'Rejected'} event freeze exception`, { actorRole: actor.role, actionType: input.decision === 'approve' ? 'approve' : 'reject', category: 'events', affectedType: 'freeze_exception', affectedId: value.id, metadata: { decision: input.decision, decisionNote: value.decisionNote } }, { prisma: tx, correlationId: value.id, actorId: actor.id });
      return mapException(value);
    });
  }

  async listFreezeExceptions(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventFreezeException[]> {
    // Exception reasons and decision notes are PMCM-internal; clients see addenda, not the exception register.
    await this.requireOperator(actor, eventId, 'freeze exception register');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
    const values = await this.prisma.opsEventFreezeException.findMany({ where: { eventId }, orderBy: { requestedAt: 'desc' } });
    return values.map(mapException);
  }

  /**
   * Client-safe change request status. Only the requested change and its status leave the server; the internal
   * reason, decision note, and actor identities stay in the PMCM register.
   */
  /** The event with its inquiry email, which client ownership falls back to when the event has no client email. */
  private readableEvent(eventId: string) {
    return this.prisma.opsEvent.findUniqueOrThrow({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
  }

  async listClientChangeRequests(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismClientChangeRequest[]> {
    await this.access.requireCanReadEvent(actor, await this.readableEvent(eventId), 'change requests');
    const values = await this.prisma.opsEventFreezeException.findMany({
      where: { eventId },
      orderBy: { requestedAt: 'desc' },
      select: CLIENT_CHANGE_REQUEST_SELECT,
    });
    return values.map(toClientChangeRequest);
  }

  async listAddenda(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismAddendum[]> {
    await this.access.requireCanReadEvent(actor, await this.readableEvent(eventId), 'addenda');
    const values = await this.prisma.opsAddendum.findMany({ where: { eventId }, orderBy: { versionNumber: 'desc' }, include: { conformeExecution: { include: { signatures: true } } } });
    const includeSupplierQuotes = this.access.canViewInternalCosts(actor);
    return values.map((value) => presentAddendumFor(mapAddendum(value), includeSupplierQuotes));
  }

  private async resolveAddendumContext(tx: Prisma.TransactionClient, eventId: string, input: IssueAddendumInput) {
    const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived) throw new BadRequestException('Archived events cannot receive addenda');
    const document = await tx.opsDocument.findFirst({ where: { id: input.documentId, eventId } });
    if (!document) throw new BadRequestException('Addendum document metadata was not found for this event');
    const exception = event.freezeStatus === 'frozen' ? await this.consumeApprovedException(tx, eventId, input.freezeExceptionId) : null;
    return { event, document, exception };
  }

  // Addenda consume the approval the same way decisions do: one conditional write, rejected if already used.
  private async consumeApprovedException(tx: Prisma.TransactionClient, eventId: string, exceptionId?: string) {
    if (!exceptionId) throw new BadRequestException('Frozen events reject scope changes without an approved exception');
    return consumeApprovedFreezeException(tx, eventId, exceptionId);
  }

  /**
   * Issuing stores the addendum as pending together with its planned commercial effect. Billing lines, quote amounts,
   * and impact rows change only when PMCM countersignature makes the addendum effective.
   */
  async issueAddendum(eventId: string, input: IssueAddendumInput, actor: ResolvedEventOpsActor): Promise<PrismAddendum> {
    await this.requireOperator(actor, eventId, 'issue addendum');
    return this.prisma.$transaction(async (tx) => {
      // One pending addendum per event: a second one would be planned against billing the first has not changed yet.
      const pending = await tx.opsAddendum.findFirst({ where: { eventId, status: 'pending' }, select: { versionNumber: true } });
      if (pending) throw new ConflictException(`Addendum v${pending.versionNumber} is still pending countersignature. Countersign or withdraw it before issuing another.`);
      const { document, exception } = await this.resolveAddendumContext(tx, eventId, input);
      const latest = await tx.opsAddendum.findFirst({ where: { eventId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
      // Comparisons run against the latest effective version; a withdrawn addendum never changed the contract or the quotes.
      const baseline = await tx.opsAddendum.findFirst({ where: { eventId, status: 'effective' }, orderBy: { versionNumber: 'desc' } });
      const comparison = { contract: compareSnapshots((baseline?.contractSnapshot ?? []) as SnapshotEntry[], input.contractSnapshot), quotes: compareSnapshots((baseline?.quoteSnapshot ?? []) as SnapshotEntry[], input.quoteSnapshot) };
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const plannedImpacts = await this.commercialAddendumImpactWriter.preview({
        eventId,
        financialDelta: input.financialDelta,
        quotePriceChanges: quotePriceChangesOf(comparison.quotes),
      }, { prisma: tx, correlationId: eventId });
      const addendum = await tx.opsAddendum.create({ data: { id: `addendum_${randomUUID()}`, eventId, versionNumber, title: input.title.trim(), summary: input.summary?.trim() ?? '', status: 'pending', documentId: document.id, contractSnapshot: toPrismaJson(input.contractSnapshot), quoteSnapshot: toPrismaJson(input.quoteSnapshot), comparison: toPrismaJson(comparison), financialDelta: input.financialDelta, plannedImpacts: toPrismaJson(plannedImpacts), freezeExceptionId: exception?.id ?? null } });
      await writeAudit(this.audit, eventId, actor.name, 'Issued immutable addendum', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'addendum', affectedId: addendum.id, metadata: { versionNumber, documentId: document.id, documentState: 'pending', signatureMethod: 'scanned_document', comparison: { contract: comparison.contract, quoteChangeCount: comparison.quotes.length }, financialDelta: input.financialDelta, freezeExceptionId: exception?.id ?? null, commercialEffect: 'pending_countersignature' } }, { prisma: tx, correlationId: addendum.id, actorId: actor.id });
      return mapAddendum(addendum);
    }, { isolationLevel: 'Serializable' });
  }

  async getException(eventId: string, exceptionId: string, actor: ResolvedEventOpsActor) {
    await this.requireOperator(actor, eventId, 'freeze exception');
    const value = await this.prisma.opsEventFreezeException.findFirst({ where: { id: exceptionId, eventId } });
    if (!value) throw new NotFoundException('Freeze exception not found');
    return mapException(value);
  }
}
