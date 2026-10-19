import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { DecideFreezeExceptionInput, FreezeEventInput, IssueAddendumInput, RequestFreezeExceptionInput, PrismAddendum, PrismClientChangeRequest, PrismEventFreezeException } from '@prism/types';
import { randomUUID } from 'node:crypto';
import { mapAddendumConformeExecution } from './addendum-conforme.mappers';
import { COMMERCIAL_ADDENDUM_IMPACT_WRITER, type CommercialAddendumImpactWriter } from '@prism/contexts/commercial';

type SnapshotEntry = Record<string, unknown>;

// Internal exception states map to neutral client wording; a pending request is still under review.
const CLIENT_CHANGE_REQUEST_STATUS = {
  pending: 'under_review',
  approved: 'approved',
  rejected: 'not_approved',
} as const;

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

function mapAddendum(value: { id: string; eventId: string; versionNumber: number; title: string; summary: string; status: string; documentId: string | null; documentState: string; signatureMethod: string; comparison: unknown; financialDelta: number; issuedAt: Date; conformeExecution?: Parameters<typeof mapAddendumConformeExecution>[0] | null }): PrismAddendum {
  return { id: value.id, eventId: value.eventId, versionNumber: value.versionNumber, title: value.title, summary: value.summary, status: 'issued', documentId: value.documentId ?? '', documentState: value.documentState as 'pending' | 'available', signatureMethod: 'scanned_document', comparison: value.comparison as PrismAddendum['comparison'], financialDelta: value.financialDelta, issuedAt: value.issuedAt.toISOString(), conforme: value.conformeExecution ? mapAddendumConformeExecution(value.conformeExecution) : null };
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
  async listClientChangeRequests(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismClientChangeRequest[]> {
    await this.access.requireCanReadEvent(actor, await this.prisma.opsEvent.findUniqueOrThrow({ where: { id: eventId } }), 'change requests');
    const values = await this.prisma.opsEventFreezeException.findMany({
      where: { eventId },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, requestedChange: true, status: true, requestedAt: true, decidedAt: true },
    });
    return values.map((value) => ({
      id: value.id,
      requestedChange: value.requestedChange,
      status: CLIENT_CHANGE_REQUEST_STATUS[value.status as keyof typeof CLIENT_CHANGE_REQUEST_STATUS] ?? 'under_review',
      updatedAt: (value.decidedAt ?? value.requestedAt).toISOString(),
    }));
  }

  async listAddenda(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismAddendum[]> {
    await this.access.requireCanReadEvent(actor, await this.prisma.opsEvent.findUniqueOrThrow({ where: { id: eventId } }), 'addenda');
    const values = await this.prisma.opsAddendum.findMany({ where: { eventId }, orderBy: { versionNumber: 'desc' }, include: { conformeExecution: { include: { signatures: true } } } });
    return values.map(mapAddendum);
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
    const consumed = await tx.opsEventFreezeException.updateMany({
      where: { id: exceptionId, eventId, status: 'approved', consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new BadRequestException('Freeze exception is not an unused approval for this event');
    return { id: exceptionId };
  }

  private async applyCommercialImpacts(
    tx: Prisma.TransactionClient,
    eventId: string,
    addendumId: string,
    versionNumber: number,
    financialDelta: number,
    changes: ReturnType<typeof compareSnapshots>,
  ) {
    const quotePriceChanges = changes.flatMap((change) => {
      const before = change.before as SnapshotEntry | null;
      const after = change.after as SnapshotEntry | null;
      const quoteId = String(after?.id ?? before?.id ?? '');
      const amount = typeof after?.amount === 'number' ? after.amount : null;
      return quoteId && amount !== null ? [{ quoteId, amount }] : [];
    });
    const impacts = await this.commercialAddendumImpactWriter.apply({
      eventId,
      versionNumber,
      financialDelta,
      quotePriceChanges,
    }, { prisma: tx, correlationId: addendumId });

    if (impacts.length > 0) {
      await tx.opsAddendumImpact.createMany({
        data: impacts.map((impact) => ({
          id: `impact_${randomUUID()}`,
          eventId,
          addendumId,
          targetType: impact.targetType,
          targetId: impact.targetId,
          beforeValue: toPrismaJson(impact.beforeValue),
          afterValue: toPrismaJson(impact.afterValue),
          deltaAmount: impact.deltaAmount,
        })),
      });
    }
  }

  async issueAddendum(eventId: string, input: IssueAddendumInput, actor: ResolvedEventOpsActor): Promise<PrismAddendum> {
    await this.requireOperator(actor, eventId, 'issue addendum');
    return this.prisma.$transaction(async (tx) => {
      const { document, exception } = await this.resolveAddendumContext(tx, eventId, input);
      const previous = await tx.opsAddendum.findFirst({ where: { eventId }, orderBy: { versionNumber: 'desc' } });
      const comparison = { contract: compareSnapshots((previous?.contractSnapshot ?? []) as SnapshotEntry[], input.contractSnapshot), quotes: compareSnapshots((previous?.quoteSnapshot ?? []) as SnapshotEntry[], input.quoteSnapshot) };
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      const addendum = await tx.opsAddendum.create({ data: { id: `addendum_${randomUUID()}`, eventId, versionNumber, title: input.title.trim(), summary: input.summary?.trim() ?? '', documentId: document.id, contractSnapshot: toPrismaJson(input.contractSnapshot), quoteSnapshot: toPrismaJson(input.quoteSnapshot), comparison: toPrismaJson(comparison), financialDelta: input.financialDelta, freezeExceptionId: exception?.id ?? null } });
      await this.applyCommercialImpacts(tx, eventId, addendum.id, versionNumber, input.financialDelta, comparison.quotes);
      await writeAudit(this.audit, eventId, actor.name, 'Issued immutable addendum', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'addendum', affectedId: addendum.id, metadata: { versionNumber, documentId: document.id, documentState: 'pending', signatureMethod: 'scanned_document', comparison, financialDelta: input.financialDelta, freezeExceptionId: exception?.id ?? null } }, { prisma: tx, correlationId: addendum.id, actorId: actor.id });
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
