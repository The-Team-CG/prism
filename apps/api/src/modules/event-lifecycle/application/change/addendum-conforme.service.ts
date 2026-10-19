import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { COMMERCIAL_ADDENDUM_IMPACT_WRITER, type CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import type {
  IssueAddendumConformeInput,
  PrismAddendumConformeExecution,
  PrismAddendumConformeStatus,
  PrismClientAddendumConforme,
  SignAddendumConformeInput,
} from '@prism/types';
import { hashSigningMetadata, isIntactContent, matchesDisplayedVersion, sha256Hex } from '../../domain/conforme-integrity';
import { addendumQuotePriceChanges, type compareSnapshots } from './change-management.service';

type SignerRole = 'client' | 'pmcm';
type RequestMetadata = { ip?: string; userAgent?: string };
type ExecutionWithContext = Prisma.OpsAddendumConformeExecutionGetPayload<{ include: { addendum: true; signatures: true } }>;
type ExecutionRow = Omit<ExecutionWithContext, 'addendum'> & { addendum: { eventId: string; versionNumber: number; title: string; summary: string } };

const CONSENT_VERSION = 'addendum-conforme-acknowledgment-v1';
const CONSENT_TEXT: Record<SignerRole, string> = {
  client: 'I have reviewed this addendum and acknowledge the scope and billing changes it describes for my event.',
  pmcm: 'PMCM countersigns this addendum exactly as acknowledged by the client.',
};
const CLIENT_VISIBLE_STATUSES = ['awaiting_client', 'awaiting_pmcm', 'completed'];
// One event carries a handful of addenda with a few versions each; the bound guards against unbounded reads.
const MAX_REGISTER_ROWS = 500;

/**
 * Versioned addendum conforme: PMCM issues an immutable document version, the primary client acknowledges it,
 * PMCM countersigns, and only then is the addendum executed and its billing impact recorded with a trace to
 * the executed version and its document hash. Unlike the onboarding conforme, this never activates an event.
 */
@Injectable()
export class AddendumConformeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(COMMERCIAL_ADDENDUM_IMPACT_WRITER) private readonly commercialAddendumImpactWriter: CommercialAddendumImpactWriter,
  ) {}

  async issueVersion(eventId: string, addendumId: string, input: IssueAddendumConformeInput, actor: ResolvedEventOpsActor): Promise<PrismAddendumConformeExecution> {
    await this.requirePmcm(actor, eventId, 'issue addendum conforme');
    return this.prisma.$transaction(async (tx) => {
      const addendum = await this.lockAddendum(tx, eventId, addendumId);
      const documentSha256 = sha256Hex(input.documentContent);
      const sameVersion = await tx.opsAddendumConformeExecution.findUnique({
        where: { addendumId_documentVersion: { addendumId, documentVersion: input.documentVersion } }, include: { signatures: true },
      });
      if (sameVersion) {
        // Idempotent retry of the same issue; a different document can never be bound to an existing version.
        if (sameVersion.documentSha256 !== documentSha256) throw new ConflictException('This addendum conforme version is already bound to different content');
        return toPmcmView({ ...sameVersion, addendum });
      }
      if (addendum.status === 'executed') throw new ConflictException('This addendum is executed; its signed conforme cannot be replaced');
      const latest = await tx.opsAddendumConformeExecution.findFirst({ where: { addendumId }, orderBy: { documentVersion: 'desc' }, include: { signatures: true } });
      if (latest && latest.status !== 'superseded' && latest.signatures.length > 0) throw new ConflictException('A signed addendum conforme version cannot be replaced');
      if (latest && input.documentVersion <= latest.documentVersion) throw new ConflictException('Addendum conforme versions must increase');
      if (latest && latest.status !== 'superseded') await this.supersede(tx, eventId, latest.id, latest.documentVersion, input.documentVersion, actor);

      const execution = await tx.opsAddendumConformeExecution.create({
        data: {
          id: `acx_${randomUUID()}`, addendumId, documentVersion: input.documentVersion,
          documentContent: input.documentContent, documentSha256, status: 'awaiting_client', issuedBy: actor.name,
        },
        include: { signatures: true },
      });
      await this.writeEntry(tx, eventId, actor, 'Issued addendum conforme for client acknowledgement', AuditActionType.Create, execution.id, {
        addendumId, addendumVersionNumber: addendum.versionNumber, documentVersion: execution.documentVersion, documentSha256,
      }, `addendum-conforme-issue:${execution.id}`);
      return toPmcmView({ ...execution, addendum });
    }, { isolationLevel: 'Serializable' });
  }

  async listForPmcm(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismAddendumConformeExecution[]> {
    await this.requirePmcm(actor, eventId, 'addendum conforme register');
    const executions = await this.prisma.opsAddendumConformeExecution.findMany({
      where: { addendum: { eventId } }, orderBy: [{ addendumId: 'asc' }, { documentVersion: 'desc' }], take: MAX_REGISTER_ROWS, include: { addendum: true, signatures: true },
    });
    return executions.map(toPmcmView);
  }

  async listForClient(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismClientAddendumConforme[]> {
    await this.requirePrimaryClient(this.prisma, actor, eventId, 'addendum conformes');
    const executions = await this.prisma.opsAddendumConformeExecution.findMany({
      where: { addendum: { eventId }, status: { in: CLIENT_VISIBLE_STATUSES } }, orderBy: { createdAt: 'desc' }, take: MAX_REGISTER_ROWS, include: { addendum: true, signatures: true },
    });
    return executions.map(toClientView);
  }

  async acknowledge(eventId: string, addendumId: string, input: SignAddendumConformeInput, actor: ResolvedEventOpsActor, metadata: RequestMetadata): Promise<PrismClientAddendumConforme> {
    await this.requireVerifiedClient(actor, eventId, 'acknowledge addendum conforme');
    return toClientView(await this.sign(eventId, addendumId, input, 'client', actor, metadata));
  }

  async countersign(eventId: string, addendumId: string, input: SignAddendumConformeInput, actor: ResolvedEventOpsActor, metadata: RequestMetadata): Promise<PrismAddendumConformeExecution> {
    await this.requirePmcm(actor, eventId, 'countersign addendum conforme');
    return toPmcmView(await this.sign(eventId, addendumId, input, 'pmcm', actor, metadata));
  }

  private async sign(eventId: string, addendumId: string, input: SignAddendumConformeInput, role: SignerRole, actor: ResolvedEventOpsActor, metadata: RequestMetadata): Promise<ExecutionRow> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAddendum(tx, eventId, addendumId);
      if (role === 'client') await this.requirePrimaryClient(tx, actor, eventId, 'acknowledge addendum conforme');
      const execution = await tx.opsAddendumConformeExecution.findUnique({ where: { id: input.executionId }, include: { addendum: true, signatures: true } });
      if (!execution || execution.addendumId !== addendumId || execution.addendum.eventId !== eventId) throw new NotFoundException('Addendum conforme not found');
      await this.assertCurrentVersion(tx, execution, input);
      const prior = execution.signatures.find((signature) => signature.actorRole === role);
      if (prior) {
        // Idempotent retry by the same signer; another account can never take over a recorded signature.
        if (prior.actorId !== actor.id) throw new ForbiddenException(`The ${role} signature belongs to a different account`);
        return execution;
      }
      assertSigningEligibility(execution, role);
      await tx.opsAddendumConformeSignature.create({
        data: {
          id: `acs_${randomUUID()}`, executionId: execution.id, actorId: actor.id!, actorRole: role, actorName: actor.name,
          actorEmail: actor.email ?? null, consentTextVersion: CONSENT_VERSION, consentText: CONSENT_TEXT[role], ...hashSigningMetadata(metadata),
        },
      });
      return role === 'client' ? this.recordClientAcknowledgement(tx, execution, actor) : this.execute(tx, execution, actor);
    }, { isolationLevel: 'Serializable' });
  }

  private async recordClientAcknowledgement(tx: Prisma.TransactionClient, execution: ExecutionWithContext, actor: ResolvedEventOpsActor) {
    const updated = await tx.opsAddendumConformeExecution.update({ where: { id: execution.id }, data: { status: 'awaiting_pmcm' }, include: { addendum: true, signatures: true } });
    await this.writeEntry(tx, execution.addendum.eventId, actor, 'Recorded client addendum conforme acknowledgement', AuditActionType.Update, execution.id, {
      addendumId: execution.addendumId, documentVersion: execution.documentVersion, documentSha256: execution.documentSha256,
    }, `addendum-conforme-acknowledge:${execution.id}`);
    return updated;
  }

  private async execute(tx: Prisma.TransactionClient, execution: ExecutionWithContext, actor: ResolvedEventOpsActor) {
    const { addendum } = execution;
    const executedAt = new Date();
    // Conditional write: an addendum is executed by exactly one conforme version.
    const executed = await tx.opsAddendum.updateMany({
      where: { id: addendum.id, executedConformeExecutionId: null },
      data: { status: 'executed', executedConformeExecutionId: execution.id, executedAt, signatureMethod: 'in_app_conforme' },
    });
    if (executed.count !== 1) throw new ConflictException('This addendum has already been executed');
    const completed = await tx.opsAddendumConformeExecution.update({ where: { id: execution.id }, data: { status: 'completed', completedAt: executedAt }, include: { addendum: true, signatures: true } });
    const impactCount = await this.recordBillingImpacts(tx, execution);
    await this.writeEntry(tx, addendum.eventId, actor, 'Countersigned addendum conforme and executed addendum', AuditActionType.Approve, execution.id, {
      addendumId: addendum.id, addendumVersionNumber: addendum.versionNumber, documentVersion: execution.documentVersion,
      documentSha256: execution.documentSha256, financialDelta: addendum.financialDelta, impactCount,
    }, `addendum-conforme-countersign:${execution.id}`);
    return completed;
  }

  private async recordBillingImpacts(tx: Prisma.TransactionClient, execution: ExecutionWithContext) {
    const { addendum } = execution;
    const comparison = (addendum.comparison ?? {}) as { quotes?: ReturnType<typeof compareSnapshots> };
    const impacts = await this.commercialAddendumImpactWriter.apply({
      eventId: addendum.eventId,
      versionNumber: addendum.versionNumber,
      financialDelta: addendum.financialDelta,
      quotePriceChanges: addendumQuotePriceChanges(comparison.quotes ?? []),
      executedConforme: { executionId: execution.id, documentVersion: execution.documentVersion, documentSha256: execution.documentSha256 },
    }, { prisma: tx, correlationId: execution.id });
    if (impacts.length === 0) return 0;
    await tx.opsAddendumImpact.createMany({
      data: impacts.map((impact) => ({
        id: `impact_${randomUUID()}`, eventId: addendum.eventId, addendumId: addendum.id, targetType: impact.targetType, targetId: impact.targetId,
        beforeValue: toPrismaJson(impact.beforeValue), afterValue: toPrismaJson(impact.afterValue), deltaAmount: impact.deltaAmount,
        conformeExecutionId: execution.id, conformeDocumentSha256: execution.documentSha256,
      })),
    });
    return impacts.length;
  }

  private async assertCurrentVersion(tx: Prisma.TransactionClient, execution: ExecutionWithContext, input: SignAddendumConformeInput) {
    if (!matchesDisplayedVersion({ version: execution.documentVersion, documentSha256: execution.documentSha256 }, { version: input.documentVersion, documentSha256: input.documentSha256 })) {
      throw new ConflictException('The displayed addendum conforme version has changed; refresh before signing');
    }
    if (!isIntactContent(execution.documentContent, execution.documentSha256)) throw new ConflictException('Addendum conforme content integrity check failed');
    const latest = await tx.opsAddendumConformeExecution.findFirst({ where: { addendumId: execution.addendumId }, orderBy: { documentVersion: 'desc' }, select: { id: true } });
    if (latest?.id !== execution.id) throw new ConflictException('A newer addendum conforme version is available');
  }

  private async supersede(tx: Prisma.TransactionClient, eventId: string, executionId: string, documentVersion: number, replacedByVersion: number, actor: ResolvedEventOpsActor) {
    await tx.opsAddendumConformeExecution.update({ where: { id: executionId }, data: { status: 'superseded' } });
    await this.writeEntry(tx, eventId, actor, 'Superseded unsigned addendum conforme version', AuditActionType.Update, executionId, { documentVersion, replacedByVersion }, `addendum-conforme-supersede:${executionId}`);
  }

  private async lockAddendum(tx: Prisma.TransactionClient, eventId: string, addendumId: string) {
    // QUERY_AUDIT_RAW_SQL: parameterized addendum row lock serializes version issue, acknowledgement, and countersignature.
    await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.addenda WHERE id = ${addendumId} FOR UPDATE`;
    const addendum = await tx.opsAddendum.findFirst({ where: { id: addendumId, eventId } });
    if (!addendum) throw new NotFoundException('Addendum not found');
    return addendum;
  }

  private async requirePmcm(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
    if (!actor.id?.trim()) throw new ForbiddenException('A verified PMCM account is required');
  }

  private async requireVerifiedClient(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], resource, eventId);
    if (!actor.verified || !actor.id?.trim() || !actor.email?.trim()) throw new ForbiddenException('A verified client account is required');
  }

  /** Only the inquiry's contact (the primary client) may see or acknowledge addendum conformes. */
  private async requirePrimaryClient(db: Pick<Prisma.TransactionClient, 'opsEvent'>, actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.requireVerifiedClient(actor, eventId, resource);
    const event = await db.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, event, resource);
    if (actor.email!.trim().toLowerCase() !== event.inquiry.email.trim().toLowerCase()) {
      await this.access.recordForbiddenAccess(actor, resource, eventId);
      throw new ForbiddenException('Only the primary client contact can acknowledge addenda');
    }
  }

  private writeEntry(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, message: string, actionType: AuditActionType, executionId: string, metadata: Record<string, unknown>, correlationId: string) {
    return writeAudit(this.audit, eventId, actor.name, message, {
      actorRole: actor.role, actorEmail: actor.email, actionType, category: AuditCategory.Documents,
      affectedType: 'addendum_conforme_execution', affectedId: executionId, metadata,
    }, { prisma: tx, correlationId, actorId: actor.id });
  }
}

function assertSigningEligibility(execution: ExecutionWithContext, role: SignerRole) {
  if (execution.status === 'superseded') throw new ConflictException('This addendum conforme version has been superseded');
  if (execution.status === 'completed') throw new ConflictException('This addendum conforme has already been executed');
  if (role === 'client' && execution.status !== 'awaiting_client') throw new ConflictException('The client acknowledgement is already recorded');
  if (role === 'pmcm' && !execution.signatures.some((signature) => signature.actorRole === 'client')) {
    throw new ConflictException('The primary client must acknowledge before PMCM countersigns');
  }
}

function toPmcmView(execution: ExecutionRow): PrismAddendumConformeExecution {
  return {
    id: execution.id, addendumId: execution.addendumId, eventId: execution.addendum.eventId, addendumVersionNumber: execution.addendum.versionNumber,
    documentVersion: execution.documentVersion, documentContent: execution.documentContent, documentSha256: execution.documentSha256,
    status: execution.status as PrismAddendumConformeStatus, issuedBy: execution.issuedBy,
    createdAt: execution.createdAt.toISOString(), completedAt: execution.completedAt?.toISOString() ?? null,
    signatures: execution.signatures.map((signature) => ({
      id: signature.id, actorRole: signature.actorRole as SignerRole, actorName: signature.actorName,
      consentTextVersion: signature.consentTextVersion, signedAt: signature.signedAt.toISOString(),
    })),
  };
}

/** Client projection: explicit fields only, so issuer and PMCM signer identity never leave the server. */
function toClientView(execution: ExecutionRow): PrismClientAddendumConforme {
  const clientSignature = execution.signatures.find((signature) => signature.actorRole === 'client');
  return {
    id: execution.id, addendumId: execution.addendumId, eventId: execution.addendum.eventId,
    addendumVersionNumber: execution.addendum.versionNumber, addendumTitle: execution.addendum.title, addendumSummary: execution.addendum.summary,
    documentVersion: execution.documentVersion, documentContent: execution.documentContent, documentSha256: execution.documentSha256,
    status: execution.status as PrismClientAddendumConforme['status'],
    clientAcknowledgedAt: clientSignature?.signedAt.toISOString() ?? null, completedAt: execution.completedAt?.toISOString() ?? null,
  };
}
