import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { CreateConformeExecutionInput, SignConformeExecutionInput } from '@prism/types';
import { InquiriesService } from './inquiries.service';
import { hashSigningMetadata, isIntactContent, matchesDisplayedVersion, sha256Hex } from '../../domain/conforme-integrity';
import type { OpsConformeExecution, Prisma } from '@prisma/client';

type SigningExecution = Prisma.OpsConformeExecutionGetPayload<{ include: { inquiry: true; signatures: true } }>;

const CONSENT_VERSION = 'conforme-acknowledgment-v1';
const CONSENT_TEXT = 'I have reviewed this conforme document and acknowledge my approval for the event arrangements described above.';

@Injectable()
export class ConformeSigningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inquiriesService: InquiriesService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  async createExecution(inquiryId: string, input: CreateConformeExecutionInput, actor: PrismVerifiedEventActor) {
    this.requirePmcm(actor);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: lock inquiry so template revisions serialize with signing and scanned-conforme activation.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.inquiries WHERE id = ${inquiryId} FOR UPDATE`;
      const inquiry = await tx.opsInquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) throw new NotFoundException('Inquiry not found');
      const requestedTemplateHash = sha256Hex(input.templateContent);
      const sameVersion = await tx.opsConformeExecution.findUnique({
        where: { inquiryId_templateVersion: { inquiryId, templateVersion: input.templateVersion } }, include: { signatures: true },
      });
      if (sameVersion) {
        if (sameVersion.templateSha256 !== requestedTemplateHash) throw new ConflictException('This conforme version is already bound to different template content');
        return this.toPublicExecution(sameVersion);
      }
      if (inquiry.status !== 'accepted') throw new ConflictException('Only accepted inquiries can receive a conforme');
      if (inquiry.conformeSignedAt) throw new ConflictException('This inquiry already has a signed conforme');
      const latest = await tx.opsConformeExecution.findFirst({ where: { inquiryId }, orderBy: { templateVersion: 'desc' } });
      await this.supersedeUnsignedExecution(tx, latest, input.templateVersion, actor);
      if (latest && input.templateVersion <= latest.templateVersion) throw new ConflictException('Conforme template versions must increase');

      const templateContent = input.templateContent;
      const documentContent = this.prefill(templateContent, {
        clientName: inquiry.clientName,
        companyName: inquiry.companyName ?? '',
        email: inquiry.email,
        eventName: inquiry.eventName,
        eventType: inquiry.eventType,
        eventDate: inquiry.eventDate.toISOString().slice(0, 10),
      });
      const execution = await tx.opsConformeExecution.create({
        data: {
          id: `cfx_${randomUUID()}`, inquiryId, templateVersion: input.templateVersion,
          templateContent, templateSha256: sha256Hex(templateContent), documentContent,
          documentSha256: sha256Hex(documentContent), status: 'awaiting_client',
        },
        include: { signatures: true },
      });
      await writeAudit(this.auditWriter, undefined, actor.actorName, 'Prepared in-app conforme for client acknowledgment', {
        actorRole: actor.actorRole, actorEmail: actor.actorEmail, actionType: AuditActionType.Create,
        category: AuditCategory.Documents, affectedType: 'conforme_execution', affectedId: execution.id,
        metadata: { inquiryId, templateVersion: execution.templateVersion, documentSha256: execution.documentSha256 },
      }, { prisma: tx, correlationId: `conforme-create:${execution.id}` });
      await writeNotification(this.notificationOutboxWriter, undefined, inquiry.email, 'A conforme is ready for your review. Sign in to the client portal and open /conforme.', 'email', {}, { prisma: tx, correlationId: `conforme-ready:${execution.id}` });
      return this.toPublicExecution(execution);
    }, { isolationLevel: 'Serializable' });
  }

  async latestForPmcm(inquiryId: string, actor: PrismVerifiedEventActor) {
    this.requirePmcm(actor);
    const execution = await this.prisma.opsConformeExecution.findFirst({
      where: { inquiryId }, orderBy: { createdAt: 'desc' }, include: { signatures: true },
    });
    if (!execution) throw new NotFoundException('Conforme execution not found');
    return this.toPublicExecution(execution);
  }

  async currentForClient(actor: PrismVerifiedEventActor) {
    this.requireClient(actor);
    const email = actor.actorEmail?.trim().toLowerCase();
    if (!email) throw new ForbiddenException('A verified client email is required');
    const active = await this.prisma.opsConformeExecution.findMany({
      where: { status: { in: ['awaiting_client', 'awaiting_pmcm'] }, inquiry: { normalizedEmail: email } },
      orderBy: { createdAt: 'desc' }, take: 20, include: { signatures: true },
    });
    const executions = active.length ? active : await this.prisma.opsConformeExecution.findMany({
      where: { status: 'completed', inquiry: { normalizedEmail: email } },
      orderBy: { completedAt: 'desc' }, take: 1, include: { signatures: true },
    });
    if (!executions.length) throw new NotFoundException('No conforme is ready for this account');
    return { executions: executions.map((execution) => this.toPublicExecution(execution)) };
  }

  async signForClient(input: SignConformeExecutionInput, actor: PrismVerifiedEventActor, requestMetadata: { ip?: string; userAgent?: string }) {
    this.requireClient(actor);
    return this.sign(input, 'client', actor, requestMetadata);
  }

  async signForPmcm(inquiryId: string, input: SignConformeExecutionInput, actor: PrismVerifiedEventActor, requestMetadata: { ip?: string; userAgent?: string }) {
    this.requirePmcm(actor);
    const execution = await this.prisma.opsConformeExecution.findUnique({ where: { id: input.executionId }, select: { inquiryId: true } });
    if (!execution || execution.inquiryId !== inquiryId) throw new NotFoundException('Conforme execution not found');
    return this.sign(input, 'pmcm', actor, requestMetadata);
  }

  private async sign(input: SignConformeExecutionInput, role: 'client' | 'pmcm', actor: PrismVerifiedEventActor, metadata: { ip?: string; userAgent?: string }) {
    const executionId = input.executionId;
    const snapshot = await this.prisma.opsConformeExecution.findUnique({ where: { id: executionId }, select: { inquiryId: true } });
    if (!snapshot) throw new NotFoundException('Conforme execution not found');
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: inquiry-first lock order serializes signatures with revisions and legacy acceptance.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.inquiries WHERE id = ${snapshot.inquiryId} FOR UPDATE`;
      // QUERY_AUDIT_RAW_SQL: serialize client/PMCM signature insertion on the immutable execution version.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.conforme_executions WHERE id = ${executionId} FOR UPDATE`;
      const execution = await tx.opsConformeExecution.findUnique({ where: { id: executionId }, include: { inquiry: true, signatures: true } });
      if (!execution) throw new NotFoundException('Conforme execution not found');
      await this.assertCurrentExecution(tx, execution, snapshot.inquiryId, input);
      await this.assertSignerScope(tx, execution, role, actor);
      const priorSignature = this.findPriorSignature(execution, role, actor);
      if (priorSignature) {
        return this.toPublicExecution(execution);
      }
      this.assertSigningEligibility(execution, role);

      await tx.opsConformeSignature.create({
        data: {
          id: `cfs_${randomUUID()}`,
          executionId,
          actorId: actor.actorId,
          actorRole: role,
          actorName: actor.actorName,
          actorEmail: actor.actorEmail ?? null,
          consentTextVersion: CONSENT_VERSION,
          consentText: CONSENT_TEXT,
          ...hashSigningMetadata(metadata),
        },
      });

      const signatures = await tx.opsConformeSignature.findMany({ where: { executionId } });
      const clientSigned = signatures.some((signature) => signature.actorRole === 'client');
      const pmcmSigned = signatures.some((signature) => signature.actorRole === 'pmcm');
      if (!clientSigned || !pmcmSigned) {
        const updated = await tx.opsConformeExecution.update({
          where: { id: executionId },
          data: { status: clientSigned ? 'awaiting_pmcm' : 'awaiting_client' },
          include: { signatures: true },
        });
        await writeAudit(this.auditWriter, execution.eventId ?? undefined, actor.actorName, `Recorded ${role} in-app conforme acknowledgment`, {
          actorRole: role === 'client' ? OpsUserRole.Client : OpsUserRole.PmcmAdmin,
          actorEmail: actor.actorEmail, actionType: AuditActionType.Update, category: AuditCategory.Documents,
          affectedType: 'conforme_execution', affectedId: executionId,
          metadata: { inquiryId: execution.inquiryId, templateVersion: execution.templateVersion, documentSha256: execution.documentSha256 },
        }, { prisma: tx, correlationId: `conforme-sign:${executionId}:${role}` });
        return this.toPublicExecution(updated);
      }

      const { event: activatedEvent } = await this.inquiriesService.activateAfterConforme(tx, execution.inquiryId, new Date());
      const now = new Date();
      await writeNotification(this.notificationOutboxWriter, activatedEvent.id, execution.inquiry.email, 'Your event workspace is ready', 'email', {}, { prisma: tx, correlationId: `conforme-activated:${executionId}` });
      const completed = await tx.opsConformeExecution.update({
        where: { id: executionId },
        data: { eventId: activatedEvent.id, status: 'completed', completedAt: now },
        include: { signatures: true },
      });
      await writeAudit(this.auditWriter, activatedEvent.id, actor.actorName, 'Completed dual in-app conforme acknowledgment and activated client workspace', {
        actorRole: role === 'client' ? OpsUserRole.Client : OpsUserRole.PmcmAdmin,
        actorEmail: actor.actorEmail, actionType: AuditActionType.Update, category: AuditCategory.Documents,
        affectedType: 'conforme_execution', affectedId: executionId,
        metadata: { inquiryId: execution.inquiryId, templateVersion: execution.templateVersion, documentSha256: execution.documentSha256, activatedEventId: activatedEvent.id },
      }, { prisma: tx, correlationId: `conforme-complete:${executionId}` });
      return this.toPublicExecution(completed);
    }, { isolationLevel: 'Serializable' });
  }

  private async supersedeUnsignedExecution(tx: Prisma.TransactionClient, latest: OpsConformeExecution | null, replacementVersion: number, actor: PrismVerifiedEventActor) {
    if (!latest || ['completed', 'superseded'].includes(latest.status)) return;
    const priorSignatures = await tx.opsConformeSignature.count({ where: { executionId: latest.id } });
    if (priorSignatures) throw new ConflictException('A conforme with a recorded signature cannot be replaced');
    await tx.opsConformeExecution.update({ where: { id: latest.id }, data: { status: 'superseded' } });
    await writeAudit(this.auditWriter, latest.eventId ?? undefined, actor.actorName, 'Superseded unsigned conforme version', {
      actorRole: actor.actorRole, actorEmail: actor.actorEmail, actionType: AuditActionType.Update,
      category: AuditCategory.Documents, affectedType: 'conforme_execution', affectedId: latest.id,
      metadata: { inquiryId: latest.inquiryId, templateVersion: latest.templateVersion, replacedByVersion: replacementVersion },
    }, { prisma: tx, correlationId: `conforme-supersede:${latest.id}` });
  }

  private async assertCurrentExecution(tx: Prisma.TransactionClient, execution: SigningExecution, inquiryId: string, input: SignConformeExecutionInput) {
    const displayed = { version: input.templateVersion, documentSha256: input.documentSha256 };
    if (execution.inquiryId !== inquiryId || !matchesDisplayedVersion({ version: execution.templateVersion, documentSha256: execution.documentSha256 }, displayed)) {
      throw new ConflictException('The displayed conforme version has changed; refresh before signing');
    }
    if (!isIntactContent(execution.documentContent, execution.documentSha256) || !isIntactContent(execution.templateContent, execution.templateSha256)) {
      throw new ConflictException('Conforme content integrity check failed');
    }
    const latest = await tx.opsConformeExecution.findFirst({ where: { inquiryId: execution.inquiryId }, orderBy: { templateVersion: 'desc' } });
    if (latest?.id !== execution.id) throw new ConflictException('A newer conforme version is available');
  }

  private async assertSignerScope(tx: Prisma.TransactionClient, execution: SigningExecution, role: 'client' | 'pmcm', actor: PrismVerifiedEventActor) {
    if (role === 'client') {
      if (execution.inquiry.normalizedEmail !== actor.actorEmail?.trim().toLowerCase()) {
        throw new ForbiddenException('This conforme is not linked to the verified client account');
      }
    } else if (!execution.signatures.some((signature) => signature.actorRole === 'client')) {
      throw new ConflictException('The client must sign before PMCM countersigns');
    }
    if (!actor.eventId) return;
    const linkedEvent = execution.eventId ?? (await tx.opsEvent.findFirst({ where: { inquiryId: execution.inquiryId }, select: { id: true } }))?.id;
    if (linkedEvent !== actor.eventId) throw new ForbiddenException('This conforme is outside the scoped event session');
  }

  private assertSigningEligibility(execution: SigningExecution, role: 'client' | 'pmcm') {
    if (execution.inquiry.status !== 'accepted' || execution.inquiry.conformeSignedAt) throw new ConflictException('Inquiry is no longer eligible for conforme signing');
    if (execution.status === 'completed') throw new ConflictException('This conforme has already been completed');
    if (execution.status === 'superseded') throw new ConflictException('This conforme version has been superseded');
    if (role === 'client' && execution.status !== 'awaiting_client') throw new ConflictException('The client signature is already recorded');
  }

  private findPriorSignature(execution: SigningExecution, role: 'client' | 'pmcm', actor: PrismVerifiedEventActor) {
    const prior = execution.signatures.find((signature) => signature.actorRole === role);
    if (prior && prior.actorId !== actor.actorId) throw new ForbiddenException(`The ${role} acknowledgment belongs to a different account`);
    return prior;
  }

  private prefill(template: string, values: Record<string, string>) {
    const unresolved = [...template.matchAll(/\{\{([a-zA-Z]+)\}\}/g)].map((match) => match[1]);
    const unknown = unresolved.find((key) => !(key in values));
    if (unknown) throw new ConflictException(`Unknown conforme template field: ${unknown}`);
    return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_token, key: string) => values[key]!);
  }

  private toPublicExecution(execution: { id: string; inquiryId: string; eventId: string | null; templateVersion: number; documentContent: string; documentSha256: string; templateSha256: string; status: string; createdAt: Date; completedAt: Date | null; signatures: Array<{ id: string; actorRole: string; actorName: string; signedAt: Date; consentTextVersion: string }> }) {
    return {
      id: execution.id, inquiryId: execution.inquiryId, eventId: execution.eventId,
      templateVersion: execution.templateVersion, documentContent: execution.documentContent,
      documentSha256: execution.documentSha256, templateSha256: execution.templateSha256,
      status: execution.status as 'awaiting_client' | 'awaiting_pmcm' | 'completed' | 'superseded', createdAt: execution.createdAt.toISOString(), completedAt: execution.completedAt?.toISOString() ?? null,
      signatures: execution.signatures.map((signature) => ({
        id: signature.id, actorRole: signature.actorRole, actorName: signature.actorName,
        signedAt: signature.signedAt.toISOString(), consentTextVersion: signature.consentTextVersion,
      })),
    };
  }

  private requirePmcm(actor: PrismVerifiedEventActor) {
    if (actor.actorRole !== OpsUserRole.PmcmAdmin && actor.actorRole !== OpsUserRole.System) throw new ForbiddenException('PMCM access is required');
  }

  private requireClient(actor: PrismVerifiedEventActor) {
    if (actor.actorRole !== OpsUserRole.Client || !actor.actorId?.trim() || !actor.actorName?.trim() || !actor.actorEmail?.trim()) throw new ForbiddenException('A verified client account is required');
  }
}
