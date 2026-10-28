import { BadRequestException, Inject, Injectable, ServiceUnavailableException, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { DOCUMENT_VAULT, PROPOSAL_REVIEW_OWNER, type DocumentVault, type ProposalReviewOwner } from '@prism/contexts/event-lifecycle';
import type { CreateCostEstimateInput, IssueProposalVersionInput, PrismCostEstimate, PrismEventProposalResponse, PrismProposalVersion, PrismVerifiedEventActor } from '@prism/types';
import { StorageObjectService } from '@prism/contexts/platform-ops';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { renderProposalPdf } from './proposal-pdf';

export const PROPOSAL_LIFECYCLE_POLICY = {
  issuedVersionsImmutable: true,
  versionNumbering: 'monotonic_per_event',
  revisionMode: 'supersede_prior_retain_history',
  revisionsAllowed: 'event_unlocked_before_event_day',
  clientNegativeDecisionReasonRequired: true,
} as const;

@Injectable()
export class ProposalLifecycleService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
    @Inject(PROPOSAL_REVIEW_OWNER) private readonly proposalReviewOwner: ProposalReviewOwner,
    @Optional() @Inject(forwardRef(() => StorageObjectService)) private readonly storageObjectService?: StorageObjectService,
  ) {}

  async createCostEstimate(eventId: string, input: CreateCostEstimateInput, actor: ResolvedEventOpsActor): Promise<PrismCostEstimate> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'cost estimate', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      await this.access.requireCanReadEvent(actor, event, 'cost estimate');
      if (event.archived || event.clientPortalStatus === 'locked') throw new BadRequestException('Cost estimates require an unlocked event');
      const totalAmount = input.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitAmount), 0);
      const estimate = await tx.opsCostEstimate.create({ data: {
        id: `ce_${randomUUID()}`, eventId, budgetAmount: input.budgetAmount, totalAmount, notes: input.notes,
        lines: { create: input.lines.map((line) => ({ id: `cel_${randomUUID()}`, category: line.category, description: line.description, quantity: line.quantity, unitAmount: line.unitAmount, totalAmount: Math.round(line.quantity * line.unitAmount), sourceLineId: line.sourceLineId ?? null })) },
      }, include: { lines: true } });
      await writeAudit(this.audit, eventId, actor.email ?? actor.name, 'Created cost estimate', { actorRole: actor.role, actionType: 'create', category: 'billing', affectedType: 'cost_estimate', affectedId: estimate.id, metadata: { budgetAmount: input.budgetAmount, totalAmount, alignment: totalAmount <= input.budgetAmount ? 'within_budget' : 'over_budget', reusedEstimateId: input.reuseEstimateId ?? null } }, { prisma: tx, correlationId: estimate.id, actorId: actor.id });
      return this.mapEstimate(estimate);
    }, { isolationLevel: 'Serializable' });
  }

  /** The latest issued proposal as the client sees it. PMCM reads the same summary; neither sees superseded versions here. */
  async getLatestIssuedProposal(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventProposalResponse> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client], 'proposal', eventId);
    // A client owns an event through its inquiry's primary contact email, so the inquiry must be loaded.
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, event, 'proposal');
    if (actor.role === OpsUserRole.Client && event.clientPortalStatus !== 'unlocked') return { proposal: null };
    const version = await this.prisma.opsProposalVersion.findFirst({ where: { eventId, status: 'issued' }, orderBy: { versionNumber: 'desc' } });
    if (!version?.issuedAt) return { proposal: null };
    return { proposal: { id: version.id, eventId, versionNumber: version.versionNumber, title: version.title, summary: version.summary, totalAmount: version.totalAmount, revisionNote: version.revisionNote, issuedAt: version.issuedAt.toISOString(), clientStatus: parseClientProposalStatus(event.proposalClientStatus) } };
  }

  async issueProposalVersion(eventId: string, input: IssueProposalVersionInput, actor: ResolvedEventOpsActor, verified: PrismVerifiedEventActor): Promise<PrismProposalVersion> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'issue proposal', eventId);
    const issued = await this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      await this.access.requireCanReadEvent(actor, event, 'issue proposal');
      if (event.archived || event.clientPortalStatus === 'locked' || event.eventDate <= new Date()) throw new BadRequestException('Proposals can only be issued before event day while the event is unlocked');
      // An approval is tied to one issued version; a silent replacement would leave "approved" on a proposal the client never saw.
      if (event.proposalClientStatus === 'approved') throw new BadRequestException('The client has approved this proposal. Record a scope change instead of issuing a new version.');
      const estimate = await tx.opsCostEstimate.findFirst({ where: { id: input.costEstimateId, eventId }, include: { lines: true } });
      if (!estimate) throw new BadRequestException('Cost estimate is not available for this event');
      const previous = await tx.opsProposalVersion.findFirst({ where: { eventId }, orderBy: { versionNumber: 'desc' } });
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      if (previous) await tx.opsProposalVersion.update({ where: { id: previous.id }, data: { status: 'superseded' } });
      const issuedAt = new Date();
      const version = await tx.opsProposalVersion.create({ data: { id: `proposal_${randomUUID()}`, eventId, costEstimateId: estimate.id, versionNumber, title: input.title, summary: input.summary, totalAmount: estimate.totalAmount, revisionNote: input.revisionNote, status: 'issued', issuedAt } });
      const reviewStateUpdated = await this.proposalReviewOwner.updateProposalReview({
        eventId,
        expectedRevisionCount: event.proposalRevisionCount,
        nextStatus: 'pending',
        nextRevisionCount: event.proposalRevisionCount,
        reviewedAt: null,
        reviewedBy: null,
      }, { prisma: tx, correlationId: `proposal:${eventId}`, actorId: actor.id });
      if (reviewStateUpdated !== 1) throw new BadRequestException('Proposal review state changed while issuing this version');
      // The client reviews an issued proposal document, so the version and its document are issued together or not at all.
      const document = await this.documentVault.registerDocument({
        eventId,
        documentKind: 'proposal',
        logicalTarget: { kind: 'proposal_version', id: version.id },
        fileName: `${proposalDocumentName(versionNumber, input.title)}.pdf`,
        status: 'issued',
        verifiedActor: verified,
      }, { prisma: tx, correlationId: version.id, actorId: actor.id });
      await this.attachProposalPdf(actor, eventId, document.id, version, event.eventName, estimate.totalAmount, { prisma: tx, correlationId: version.id, actorId: actor.id });
      await writeAudit(this.audit, eventId, actor.email ?? actor.name, 'Issued proposal version', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'proposal_version', affectedId: version.id, metadata: { versionNumber, costEstimateId: estimate.id, totalAmount: estimate.totalAmount, policy: { issuedVersionsImmutable: PROPOSAL_LIFECYCLE_POLICY.issuedVersionsImmutable, versionNumbering: PROPOSAL_LIFECYCLE_POLICY.versionNumbering, revisionMode: PROPOSAL_LIFECYCLE_POLICY.revisionMode, revisionsAllowed: PROPOSAL_LIFECYCLE_POLICY.revisionsAllowed } } }, { prisma: tx, correlationId: version.id, actorId: actor.id });
      return { version, documentId: document.id, eventName: event.eventName, totalAmount: estimate.totalAmount };
    }, { isolationLevel: 'Serializable' });
    return this.mapProposalVersion(issued.version);
  }

  private async attachProposalPdf(
    actor: ResolvedEventOpsActor,
    eventId: string,
    documentId: string,
    version: { id: string; versionNumber: number; title: string; summary: string; revisionNote: string; issuedAt: Date | null },
    eventName: string,
    totalAmount: number,
    context: PrismTransactionContext,
  ) {
    const pdf = renderProposalPdf({ eventName, versionNumber: version.versionNumber, title: version.title, summary: version.summary, revisionNote: version.revisionNote, totalAmount, issuedAt: version.issuedAt ?? new Date() });
    const file = await this.storeProposalPdf(actor, eventId, version.id, pdf, version.versionNumber, context);
    if (!file.storageKey) throw new ServiceUnavailableException('Proposal PDF storage is unavailable');
    await this.documentVault.attachStoredFile({ eventId, documentId, storageBucket: 'document-vault', storageKey: file.storageKey, mimeType: 'application/pdf', sizeBytes: file.sizeBytes, generatedFileName: file.fileName }, context);
  }

  /** Store the client copy before the issuing transaction commits. */
  private async storeProposalPdf(actor: ResolvedEventOpsActor, eventId: string, versionId: string, pdf: Uint8Array, versionNumber: number, context: PrismTransactionContext) {
    const fileName = `proposal-v${versionNumber}.pdf`;
    const file = { fileName, sizeBytes: pdf.byteLength, storageKey: '' };
    if (!this.storageObjectService) throw new ServiceUnavailableException('Proposal PDF storage is unavailable');
    const storageActor = { ...actor, eventId, explicit: true };
    const stored = await this.storageObjectService.requestUpload({
      eventId,
      ownerRecordType: 'proposal_version',
      ownerRecordId: versionId,
      logicalTarget: `proposal-version:${versionId}`,
      usage: 'event_deliverable',
      fileName,
      contentType: 'application/pdf',
      declaredByteSize: pdf.byteLength,
      checksumSha256: createHash('sha256').update(pdf).digest('hex'),
      actor: storageActor,
      context,
    });
    if (stored.status === 'stored') return { ...file, storageKey: stored.object.providerObjectKey ?? '' };
    if (stored.status !== 'ready') throw new ServiceUnavailableException('Proposal PDF storage is unavailable');
    const confirmed = await this.storageObjectService.confirmUpload({
      objectId: stored.object.id,
      checksumSha256: stored.object.checksumSha256,
      byteSize: pdf.byteLength,
      bytes: pdf,
      actor: storageActor,
      context,
    });
    return { ...file, storageKey: confirmed.providerObjectKey ?? stored.object.providerObjectKey ?? '' };
  }

  private mapEstimate(value: Prisma.OpsCostEstimateGetPayload<{ include: { lines: true } }>): PrismCostEstimate { return { id: value.id, eventId: value.eventId, budgetAmount: value.budgetAmount, totalAmount: value.totalAmount, alignment: value.totalAmount <= value.budgetAmount ? 'within_budget' : 'over_budget', status: parseCostEstimateStatus(value.status), notes: value.notes, createdAt: value.createdAt.toISOString(), lines: value.lines.map((line) => ({ id: line.id, category: line.category, description: line.description, quantity: Number(line.quantity), unitAmount: line.unitAmount, totalAmount: line.totalAmount, sourceLineId: line.sourceLineId })) }; }

  private mapProposalVersion(value: { id: string; eventId: string; versionNumber: number; title: string; summary: string; costEstimateId: string; totalAmount: number; status: string; revisionNote: string; issuedAt: Date | null }): PrismProposalVersion {
    return { ...value, status: parseProposalVersionStatus(value.status), issuedAt: value.issuedAt?.toISOString() ?? null };
  }
}

function parseProposalVersionStatus(status: string): PrismProposalVersion['status'] {
  if (status === 'draft' || status === 'issued' || status === 'superseded') return status;
  throw new Error(`Unexpected proposal version status: ${status}`);
}

function parseCostEstimateStatus(status: string): PrismCostEstimate['status'] {
  if (status === 'draft' || status === 'approved') return status;
  throw new Error(`Unexpected cost estimate status: ${status}`);
}

function parseClientProposalStatus(status: string | null | undefined): 'pending' | 'approved' | 'revision_requested' {
  return status === 'approved' || status === 'revision_requested' ? status : 'pending';
}

/** Titles can contain path separators, which the document vault would read as a folder prefix. */
function proposalDocumentName(versionNumber: number, title: string) {
  return `Proposal v${versionNumber} - ${title.replace(/[\\/]+/g, '-').trim().slice(0, 80)}`;
}
