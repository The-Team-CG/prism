import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { OpsClientReviewDecision, OpsClientReviewItem } from '@prisma/client';
import type { CreateClientReviewItemInput, DecideClientReviewItemInput } from '@prism/types';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { isPrimaryClientContact } from '../../domain/proposal-client-review.policy';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import { DOCUMENT_VAULT, type DocumentVault } from '@prism/contexts/event-lifecycle';

@Injectable()
export class ClientReviewItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly lifecycleEventReferences: OperationsEventReferenceReader,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client, OpsUserRole.PmcmAdmin], 'client venue and styling review', eventId);
    const event = await this.lifecycleEventReferences.findEventReadAccess(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.eventAccessPolicyService.requireCanReadEvent(actor, { ...event, inquiry: { email: event.inquiry?.email ?? '' } }, 'client venue and styling review');
    if (actor.role === OpsUserRole.Client && !isPrimaryClientContact(actor.email ?? '', event.inquiry?.email ?? '')) {
      throw new ForbiddenException('Only the primary client contact can review venue and styling options');
    }
    const items = await this.prisma.opsClientReviewItem.findMany({
      where: { eventId, ...(actor.role === OpsUserRole.Client ? { status: 'published' } : {}) },
      include: { decisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ kind: 'asc' }, { version: 'desc' }],
      take: 200,
    });
    return items.map((item) => {
      const decision = 'decisions' in item ? item.decisions?.[0] : undefined;
      return {
        ...this.mapItem(item),
        clientDecision: decision ? this.mapDecision(decision) : null,
      };
    });
  }

  async issue(eventId: string, input: CreateClientReviewItemInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'issue client venue or styling option', eventId);
    const key = input.idempotencyKey?.trim();
    if (!key) throw new BadRequestException('An idempotency key is required to issue a client review item');
    const payloadHash = this.hash({ kind: input.kind, title: input.title, summary: input.summary, budgetRange: input.budgetRange ?? null, documentId: input.documentId ?? null });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockEvent(tx, eventId);
        await this.requireIssueEvent(tx, eventId, key);
        const prior = await tx.opsClientReviewItem.findUnique({ where: { idempotencyKey: key } });
        if (prior) return this.mapItem(this.requireIssueReplay(prior, eventId, actor, payloadHash));
        await this.validateIssueDocument(tx, eventId, input.documentId, key);
        const latest = await tx.opsClientReviewItem.findFirst({ where: { eventId, kind: input.kind }, orderBy: { version: 'desc' }, select: { version: true } });
        const item = await tx.opsClientReviewItem.create({
          data: {
            id: `client_review_${randomUUID()}`,
            eventId,
            kind: input.kind,
            title: input.title,
            summary: input.summary,
            version: (latest?.version ?? 0) + 1,
            status: 'published',
            budgetRange: input.budgetRange ?? null,
            documentId: input.documentId ?? null,
            createdBy: actor.id ?? actor.email ?? actor.name,
            idempotencyKey: key,
            payloadHash,
            publishedAt: new Date(),
          },
        });
        await writeAudit(this.auditWriter, eventId, actor.name, `Issued ${input.kind} option to client`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Events,
          affectedType: 'client_review_item',
          affectedId: item.id,
          affectedLabel: item.title,
          metadata: { kind: item.kind, version: item.version, documentId: item.documentId },
        }, { prisma: tx, correlationId: key, actorId: actor.id });
        return this.mapItem(item);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.opsClientReviewItem.findUnique({ where: { idempotencyKey: key } });
        if (replay && replay.eventId === eventId && replay.createdBy === actor.id && replay.payloadHash === payloadHash) return this.mapItem(replay);
        throw new BadRequestException('A client review item was issued concurrently; retry with a new idempotency key');
      }
      throw error;
    }
  }

  private async requireIssueEvent(tx: Prisma.TransactionClient, eventId: string, key: string) {
    const context = { prisma: tx, correlationId: `client-review-issue:${key}` };
    const [event, access] = await Promise.all([
      this.lifecycleEventReferences.findOperationsEvent(eventId, context),
      this.lifecycleEventReferences.findEventReadAccess(eventId, context),
    ]);
    if (!event) throw new NotFoundException('Event not found');
    if (!access || event.archived || access.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client review items require an unlocked, active event');
  }

  private requireIssueReplay(item: OpsClientReviewItem, eventId: string, actor: ResolvedEventOpsActor, payloadHash: string) {
    if (item.eventId !== eventId || item.createdBy !== (actor.id ?? actor.email ?? actor.name) || item.payloadHash !== payloadHash) {
      throw new BadRequestException('Idempotency key was reused for another client review item');
    }
    return item;
  }

  private async validateIssueDocument(tx: Prisma.TransactionClient, eventId: string, documentId: string | undefined, key: string) {
    if (!documentId) return;
    try {
      await this.documentVault.findEligibleReference({ eventId, purpose: 'client_proposal_review', documentId }, { prisma: tx, correlationId: `client-review-document:${key}` });
    } catch (error) {
      if (error instanceof NotFoundException) throw new BadRequestException('Only an issued event document can be attached to a client review item');
      throw error;
    }
  }

  async decide(eventId: string, itemId: string, input: DecideClientReviewItemInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'venue or styling decision', eventId);
    if (!actor.id) throw new ForbiddenException('A verified client identity is required to record this decision');
    const actorId = actor.id;
    const key = input.idempotencyKey?.trim() || `client-review:${itemId}:${input.itemVersion}:${actorId}`;
    const payloadHash = this.hash({ itemId, itemVersion: input.itemVersion, action: input.action, comment: input.comment });
    return this.prisma.$transaction(async (tx) => {
      await this.authorizeClientDecision(tx, eventId, actor, key);
      const prior = await tx.opsClientReviewDecision.findUnique({ where: { idempotencyKey: key } });
      if (prior) return this.mapDecision(this.requireDecisionReplay(prior, eventId, actorId, payloadHash));
      const item = await this.requireCurrentPublishedItem(tx, eventId, itemId, input.itemVersion, actorId);
      const decision = await this.createDecision(tx, { eventId, item, input, actor, actorId, key, payloadHash, itemId });
      await writeAudit(this.auditWriter, eventId, actor.name, input.action === 'approve' ? `Client approved ${item.kind} option` : `Client requested ${item.kind} revision`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'client_review_decision',
        affectedId: decision.id,
        affectedLabel: item.title,
        metadata: { itemId, version: item.version, action: input.action, comment: input.comment },
      }, { prisma: tx, correlationId: key, actorId: actor.id });
      return this.mapDecision(decision);
    });
  }

  private async authorizeClientDecision(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, key: string) {
    await this.lockEvent(tx, eventId);
    const context = { prisma: tx, correlationId: `client-review-decision:${key}` };
    const [event, access] = await Promise.all([
      this.lifecycleEventReferences.findOperationsEvent(eventId, context),
      this.lifecycleEventReferences.findEventReadAccess(eventId, context),
    ]);
    if (!event || !access) throw new NotFoundException('Event not found');
    await this.eventAccessPolicyService.requireCanReadEvent(actor, { ...access, inquiry: { email: access.inquiry?.email ?? '' } }, 'venue or styling decision');
    if (!isPrimaryClientContact(actor.email ?? '', access.inquiry?.email ?? '')) throw new ForbiddenException('Only the primary client contact can review venue and styling options');
    if (event.archived || access.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client decisions are locked for this event');
  }

  private requireDecisionReplay(decision: OpsClientReviewDecision, eventId: string, actorId: string, payloadHash: string) {
    if (decision.eventId !== eventId || decision.actorId !== actorId || decision.payloadHash !== payloadHash) {
      throw new BadRequestException('Idempotency key was reused for another client decision');
    }
    return decision;
  }

  private async requireCurrentPublishedItem(tx: Prisma.TransactionClient, eventId: string, itemId: string, version: number, actorId: string): Promise<OpsClientReviewItem> {
    const item = await tx.opsClientReviewItem.findFirst({ where: { id: itemId, eventId } });
    if (!item) throw new NotFoundException('Client review item not found');
    if (item.status !== 'published') throw new BadRequestException('Only a published option can be reviewed');
    if (item.version !== version) throw new BadRequestException('This option version is stale; review the latest version');
    const [latest, existing] = await Promise.all([
      tx.opsClientReviewItem.findFirst({ where: { eventId, kind: item.kind }, orderBy: { version: 'desc' }, select: { version: true } }),
      tx.opsClientReviewDecision.findFirst({ where: { itemId, itemVersion: version, actorId } }),
    ]);
    if (latest?.version !== item.version) throw new BadRequestException('A newer option is available; review the latest version');
    if (existing) throw new BadRequestException('This option version already has a client decision; PMCM must issue a new version');
    return item;
  }

  private async createDecision(
    tx: Prisma.TransactionClient,
    args: { eventId: string; item: OpsClientReviewItem; input: DecideClientReviewItemInput; actor: ResolvedEventOpsActor; actorId: string; key: string; payloadHash: string; itemId: string },
  ): Promise<OpsClientReviewDecision> {
    try {
      return await tx.opsClientReviewDecision.create({ data: {
        id: `client_review_decision_${randomUUID()}`, eventId: args.eventId, itemId: args.itemId,
        itemVersion: args.item.version, action: args.input.action, comment: args.input.comment,
        payload: toPrismaJson({ kind: args.item.kind, title: args.item.title, version: args.item.version }),
        actorId: args.actorId, actorEmail: args.actor.email ?? null,
        idempotencyKey: args.key, payloadHash: args.payloadHash,
      } });
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      const replay = await tx.opsClientReviewDecision.findUnique({ where: { idempotencyKey: args.key } });
      if (replay) return this.requireDecisionReplay(replay, args.eventId, args.actorId, args.payloadHash);
      throw new BadRequestException('This option version already has a client decision or the idempotency key was reused');
    }
  }

  private mapItem(item: { id: string; eventId: string; kind: string; title: string; summary: string; version: number; status: string; budgetRange: string | null; documentId: string | null; publishedAt: Date | null; createdAt: Date }) {
    return {
      id: item.id, eventId: item.eventId, kind: item.kind, title: item.title, summary: item.summary,
      version: item.version, status: item.status, budgetRange: item.budgetRange ?? undefined,
      documentId: item.documentId ?? undefined, publishedAt: item.publishedAt?.toISOString(), createdAt: item.createdAt.toISOString(),
    };
  }

  private mapDecision(decision: { id: string; itemId: string; itemVersion: number; action: string; comment: string; createdAt: Date }) {
    return { id: decision.id, itemId: decision.itemId, itemVersion: decision.itemVersion, action: decision.action, comment: decision.comment, decidedAt: decision.createdAt.toISOString() };
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async lockEvent(tx: Prisma.TransactionClient, eventId: string) {
    const event = await this.lifecycleEventReferences.findOperationsEvent(eventId, { prisma: tx, correlationId: `client-review-event:${eventId}` });
    if (!event) throw new NotFoundException('Event not found');
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
