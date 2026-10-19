import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { COMMERCIAL_ADDENDUM_IMPACT_WRITER, isPrimaryClientContact, type CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { PrismAddendumConformeExecution, SignAddendumConformeExecutionInput } from '@prism/types';
import {
  ADDENDUM_CONSENT_TEXT,
  ADDENDUM_CONSENT_VERSION,
  buildAddendumConformeDocument,
  sha256,
  type AddendumConformeSnapshot,
} from './addendum-conforme-document';
import { mapAddendumConformeExecution } from './addendum-conforme.mappers';

type SignerRole = 'client' | 'pmcm';
type RequestMetadata = { ip?: string; userAgent?: string };
type ExecutionWithContext = Prisma.OpsAddendumConformeExecutionGetPayload<{ include: { signatures: true; event: { include: { inquiry: true } } } }>;
type ComparisonChanges = AddendumConformeSnapshot['comparison']['contract'];

@Injectable()
export class AddendumConformeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications: NotificationOutboxWriter,
    @Inject(COMMERCIAL_ADDENDUM_IMPACT_WRITER) private readonly commercial: CommercialAddendumImpactWriter,
  ) {}

  /** PMCM prepares the conforme for an issued addendum. One execution exists per addendum version; replays return it unchanged. */
  async requestExecution(eventId: string, addendumId: string, actor: ResolvedEventOpsActor): Promise<PrismAddendumConformeExecution> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'addendum conforme request', eventId);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize concurrent signing requests for one immutable addendum version.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.addenda WHERE id = ${addendumId} FOR UPDATE`;
      const addendum = await tx.opsAddendum.findFirst({
        where: { id: addendumId, eventId },
        include: { conformeExecution: { include: { signatures: true } }, event: { include: { inquiry: true } } },
      });
      if (!addendum) throw new NotFoundException('Addendum not found');
      if (addendum.conformeExecution) return mapAddendumConformeExecution(addendum.conformeExecution);
      if (addendum.event.archived) throw new BadRequestException('Archived events cannot receive addendum conformes');

      const snapshot = this.snapshotOf(addendum, addendum.event.eventName);
      const document = buildAddendumConformeDocument(snapshot);
      const execution = await tx.opsAddendumConformeExecution.create({
        data: {
          id: `acx_${randomUUID()}`, addendumId, eventId, versionNumber: addendum.versionNumber, snapshot: toPrismaJson(snapshot),
          documentContent: document.content, documentSha256: document.sha256, status: 'awaiting_client',
        },
        include: { signatures: true },
      });
      await writeAudit(this.audit, eventId, actor.name, 'Prepared addendum conforme for client acknowledgment', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Documents,
        affectedType: 'addendum_conforme_execution', affectedId: execution.id,
        metadata: { addendumId, versionNumber: execution.versionNumber, documentSha256: execution.documentSha256 },
      }, { prisma: tx, correlationId: `addendum-conforme-create:${execution.id}`, actorId: actor.id });
      await writeNotification(this.notifications, eventId, addendum.event.inquiry.email, 'An addendum conforme is ready for your review. Sign in to the client portal and open your event overview.', 'email', {}, { prisma: tx, correlationId: `addendum-conforme-ready:${execution.id}` });
      return mapAddendumConformeExecution(execution);
    }, { isolationLevel: 'Serializable' });
  }

  /** Only the event's verified primary client may acknowledge; the client always signs before PMCM. */
  async acknowledgeAsClient(eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput, actor: ResolvedEventOpsActor, metadata: RequestMetadata) {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], 'addendum conforme acknowledgment', eventId);
    return this.sign('client', eventId, addendumId, input, actor, metadata);
  }

  /** Only a PMCM admin may countersign, and only after the client acknowledgment is recorded. */
  async countersignAsPmcm(eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput, actor: ResolvedEventOpsActor, metadata: RequestMetadata) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'addendum conforme countersignature', eventId);
    return this.sign('pmcm', eventId, addendumId, input, actor, metadata);
  }

  private async sign(role: SignerRole, eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput, actor: ResolvedEventOpsActor, metadata: RequestMetadata) {
    this.requireVerifiedIdentity(actor);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: serialize client/PMCM signature insertion on the immutable execution version.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.addendum_conforme_executions WHERE id = ${input.executionId} FOR UPDATE`;
      const execution = await tx.opsAddendumConformeExecution.findUnique({
        where: { id: input.executionId }, include: { signatures: true, event: { include: { inquiry: true } } },
      });
      if (!execution || execution.addendumId !== addendumId || execution.eventId !== eventId) throw new NotFoundException('Addendum conforme not found');
      await this.assertSignerScope(role, execution, actor);
      this.assertDisplayedVersion(execution, input);
      if (this.findPriorSignature(execution, role, actor)) return mapAddendumConformeExecution(execution);
      this.assertSigningTurn(execution, role);

      await tx.opsAddendumConformeSignature.create({
        data: {
          id: `acs_${randomUUID()}`, executionId: execution.id, actorId: actor.id!, actorRole: role, actorName: actor.name,
          actorEmail: actor.email ?? null, consentTextVersion: ADDENDUM_CONSENT_VERSION, consentText: ADDENDUM_CONSENT_TEXT,
          ipHash: metadata.ip ? sha256(metadata.ip) : null, userAgentHash: metadata.userAgent ? sha256(metadata.userAgent) : null,
        },
      });
      return role === 'client' ? this.recordClientAcknowledgment(tx, execution, actor) : this.completeWithCountersignature(tx, execution, actor);
    }, { isolationLevel: 'Serializable' });
  }

  private async recordClientAcknowledgment(tx: Prisma.TransactionClient, execution: ExecutionWithContext, actor: ResolvedEventOpsActor) {
    const updated = await tx.opsAddendumConformeExecution.update({ where: { id: execution.id }, data: { status: 'awaiting_pmcm' }, include: { signatures: true } });
    await this.auditSignature(tx, execution, actor, 'Recorded client addendum conforme acknowledgment', 'client');
    return mapAddendumConformeExecution(updated);
  }

  private async completeWithCountersignature(tx: Prisma.TransactionClient, execution: ExecutionWithContext, actor: ResolvedEventOpsActor) {
    const completedAt = new Date();
    // The billing line carrying this addendum's delta is found through the addendum's own impact record, then matched by addendum id.
    const billingSourceId = await this.addendumBillingSourceId(tx, execution.addendumId);
    const trace = billingSourceId
      ? await this.commercial.recordConformeExecution({
        eventId: execution.eventId, addendumId: execution.addendumId, billingSourceId, versionNumber: execution.versionNumber,
        executionId: execution.id, documentSha256: execution.documentSha256, executedAt: completedAt.toISOString(),
      }, { prisma: tx, correlationId: execution.addendumId })
      : null;
    const completed = await tx.opsAddendumConformeExecution.update({
      where: { id: execution.id }, data: { status: 'completed', completedAt, billingSourceId: trace?.billingSourceId ?? null }, include: { signatures: true },
    });
    await this.auditSignature(tx, execution, actor, 'Completed addendum conforme with PMCM countersignature', 'pmcm', { billingSourceId: trace?.billingSourceId ?? null });
    return mapAddendumConformeExecution(completed);
  }

  private async addendumBillingSourceId(tx: Prisma.TransactionClient, addendumId: string): Promise<string | null> {
    const impact = await tx.opsAddendumImpact.findFirst({ where: { addendumId, targetType: 'billing_source' }, select: { targetId: true } });
    return impact?.targetId ?? null;
  }

  private async auditSignature(tx: Prisma.TransactionClient, execution: ExecutionWithContext, actor: ResolvedEventOpsActor, action: string, role: SignerRole, extra: Record<string, unknown> = {}) {
    await writeAudit(this.audit, execution.eventId, actor.name, action, {
      actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Documents,
      affectedType: 'addendum_conforme_execution', affectedId: execution.id,
      metadata: { addendumId: execution.addendumId, versionNumber: execution.versionNumber, documentSha256: execution.documentSha256, ...extra },
    }, { prisma: tx, correlationId: `addendum-conforme-sign:${execution.id}:${role}`, actorId: actor.id });
  }

  private requireVerifiedIdentity(actor: ResolvedEventOpsActor) {
    if (!actor.verified || !actor.id?.trim() || !actor.name?.trim()) throw new ForbiddenException('A verified account is required to sign an addendum conforme');
  }

  private async assertSignerScope(role: SignerRole, execution: ExecutionWithContext, actor: ResolvedEventOpsActor) {
    if (role !== 'client') return;
    await this.access.requireCanReadEvent(actor, { ...execution.event, inquiry: { email: execution.event.inquiry.email } }, 'addendum conforme acknowledgment');
    if (!isPrimaryClientContact(actor.email, execution.event.inquiry.email)) throw new ForbiddenException('Only the primary client contact can acknowledge an addendum conforme');
  }

  private assertDisplayedVersion(execution: ExecutionWithContext, input: SignAddendumConformeExecutionInput) {
    if (execution.versionNumber !== input.versionNumber || execution.documentSha256 !== input.documentSha256.toLowerCase()) {
      throw new ConflictException('The displayed addendum conforme version has changed; refresh before signing');
    }
    if (execution.documentSha256 !== sha256(execution.documentContent)) throw new ConflictException('Addendum conforme content integrity check failed');
  }

  private findPriorSignature(execution: ExecutionWithContext, role: SignerRole, actor: ResolvedEventOpsActor) {
    const prior = execution.signatures.find((signature) => signature.actorRole === role);
    if (prior && prior.actorId !== actor.id) throw new ForbiddenException(`The ${role} acknowledgment belongs to a different account`);
    return prior;
  }

  private assertSigningTurn(execution: ExecutionWithContext, role: SignerRole) {
    if (role === 'pmcm' && !execution.signatures.some((signature) => signature.actorRole === 'client')) {
      throw new ConflictException('The client must acknowledge before PMCM countersigns');
    }
    if (execution.status === 'completed') throw new ConflictException('This addendum conforme has already been completed');
  }

  /** Client-safe snapshot: only the contract-level comparison is signed; supplier quote lines stay PMCM-only. */
  private snapshotOf(addendum: { versionNumber: number; title: string; summary: string; financialDelta: number; comparison: unknown }, eventName: string): AddendumConformeSnapshot {
    const comparison = (addendum.comparison ?? {}) as { contract?: ComparisonChanges };
    return {
      eventName, versionNumber: addendum.versionNumber, title: addendum.title, summary: addendum.summary,
      financialDelta: addendum.financialDelta, comparison: { contract: comparison.contract ?? [] },
    };
  }
}
