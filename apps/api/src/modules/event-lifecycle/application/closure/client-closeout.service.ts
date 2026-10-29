import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AcknowledgeClientDeliverableInput, ClientTestimonialModerationInput, SubmitClientCloseoutResponseInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { isPrimaryClientContact } from '@prism/contexts/commercial';

@Injectable()
export class ClientCloseoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async get(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client event closeout', eventId);
    const event = await this.loadClientEvent(this.prisma, eventId, actor);
    const [wrapUp, deliverables, response] = await Promise.all([
      this.prisma.opsEventWrapUp.findUnique({ where: { eventId } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId, status: 'submitted' }, orderBy: [{ title: 'asc' }, { id: 'asc' }], take: 100 }),
      this.prisma.opsClientCloseoutResponse.findUnique({ where: { eventId } }),
    ]);
    return {
      eventId,
      actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
      wrapUp: wrapUp ? {
        status: wrapUp.status,
        acknowledgementRecorded: Boolean(wrapUp.clientAcknowledgedAt),
        clientAcknowledgedAt: wrapUp.acknowledgementSource === 'client' ? wrapUp.clientAcknowledgedAt?.toISOString() ?? null : null,
        acknowledgementNote: wrapUp.acknowledgementSource === 'client' ? wrapUp.clientAcknowledgementNote : '',
      } : null,
      deliverables: deliverables.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        required: item.required,
        acknowledgementRecorded: Boolean(item.clientAcknowledgedAt),
        acknowledgedAt: item.acknowledgementSource === 'client' ? item.clientAcknowledgedAt?.toISOString() ?? null : null,
        acknowledgementNote: item.acknowledgementSource === 'client' ? item.clientAcknowledgementNote : '',
      })),
      response: response ? this.mapClientResponse(response) : null,
    };
  }

  async acknowledgeDeliverable(eventId: string, documentId: string, input: AcknowledgeClientDeliverableInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client deliverable acknowledgement', eventId);
    this.requireActorId(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, eventId);
      const event = await this.loadClientEvent(tx, eventId, actor);
      if (event.archived) throw new BadRequestException('Archived closeout records are read-only');
      const document = await tx.opsPostEventDocument.findFirst({ where: { id: documentId, eventId } });
      if (!document) throw new NotFoundException('Closeout deliverable not found');
      if (document.status !== 'submitted') throw new BadRequestException('Only a delivered closeout document can be acknowledged');
      if (document.clientAcknowledgedAt) {
        if (document.acknowledgementSource === 'client' && document.acknowledgementRecordedBy === actor.id && document.clientAcknowledgementNote === input.note) return this.mapDeliverableAck(document);
        throw new BadRequestException('This deliverable already has an acknowledgement');
      }
      const updated = await tx.opsPostEventDocument.updateMany({
        where: { id: documentId, eventId, status: 'submitted', clientAcknowledgedAt: null },
        data: { clientAcknowledgedAt: new Date(), acknowledgementRecordedBy: actor.id, acknowledgementSource: 'client', clientAcknowledgementNote: input.note },
      });
      if (updated.count !== 1) throw new BadRequestException('Deliverable changed while it was being acknowledged');
      const saved = await tx.opsPostEventDocument.findFirstOrThrow({ where: { id: documentId, eventId } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Client acknowledged deliverable: ${saved.title}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Approve,
        category: AuditCategory.Events,
        affectedType: 'post_event_document',
        affectedId: saved.id,
        affectedLabel: saved.title,
        metadata: { acknowledgementSource: 'client', note: input.note },
      }, { prisma: tx, correlationId: `client-deliverable-ack:${saved.id}`, actorId: actor.id });
      return this.mapDeliverableAck(saved);
    });
  }

  async acknowledgeWrapUp(eventId: string, input: AcknowledgeClientDeliverableInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client closeout acknowledgement', eventId);
    this.requireActorId(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, eventId);
      const event = await this.loadClientEvent(tx, eventId, actor);
      if (!event.actualEndedAt) throw new BadRequestException('Event closeout is not available until the event has ended');
      if (event.archived) throw new BadRequestException('Archived closeout records are read-only');
      const wrapUp = await tx.opsEventWrapUp.findUnique({ where: { eventId } });
      if (!wrapUp) throw new BadRequestException('PMCM has not opened the event closeout yet');
      if (wrapUp.clientAcknowledgedAt) {
        if (wrapUp.acknowledgementSource === 'client' && wrapUp.acknowledgementRecordedBy === actor.id && wrapUp.clientAcknowledgementNote === input.note) return this.mapWrapUpAck(wrapUp);
        throw new BadRequestException('Closeout has already been acknowledged');
      }
      const updated = await tx.opsEventWrapUp.updateMany({
        where: { eventId, clientAcknowledgedAt: null },
        data: { clientAcknowledgedAt: new Date(), acknowledgementRecordedBy: actor.id, acknowledgementSource: 'client', clientAcknowledgementNote: input.note },
      });
      if (updated.count !== 1) throw new BadRequestException('Closeout changed while it was being acknowledged');
      const saved = await tx.opsEventWrapUp.findUniqueOrThrow({ where: { eventId } });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Client acknowledged event closeout', {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Approve,
        category: AuditCategory.Events,
        affectedType: 'event_wrap_up',
        affectedId: saved.id,
        metadata: { acknowledgementSource: 'client', note: input.note },
      }, { prisma: tx, correlationId: `client-wrap-up-ack:${eventId}`, actorId: actor.id });
      return this.mapWrapUpAck(saved);
    });
  }

  async submitResponse(eventId: string, input: SubmitClientCloseoutResponseInput, actor: ResolvedEventOpsActor) {
    if (!actor.id) throw new ForbiddenException('A verified client identity is required to submit event feedback');
    const actorId = actor.id;
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'client event feedback', eventId);
    this.requireActorId(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, eventId);
      const event = await this.loadClientEvent(tx, eventId, actor);
      if (!event.actualEndedAt) throw new BadRequestException('Feedback is available after the event has ended');
      if (event.archived) throw new BadRequestException('Archived closeout feedback is read-only');
      const existing = await tx.opsClientCloseoutResponse.findUnique({ where: { eventId } });
      if (existing && existing.moderationStatus !== 'pending') throw new BadRequestException('Feedback cannot be edited after PMCM moderation');
      if (existing && existing.actorId !== actorId) throw new ForbiddenException('Only the client who submitted this feedback can update it');
      const response = existing
        ? await tx.opsClientCloseoutResponse.update({
          where: { eventId },
          data: { rating: input.rating, feedback: input.feedback, testimonial: input.testimonial, testimonialConsent: input.testimonialConsent, moderationStatus: 'pending' },
        })
        : await tx.opsClientCloseoutResponse.create({
          data: {
            id: `client_closeout_${randomUUID()}`,
            eventId,
            rating: input.rating,
            feedback: input.feedback,
            testimonial: input.testimonial,
            testimonialConsent: input.testimonialConsent,
            moderationStatus: 'pending',
            actorId,
            actorEmail: actor.email ?? null,
          },
        });
      await writeAudit(this.auditWriter, eventId, actor.name, existing ? 'Client updated closeout feedback' : 'Client submitted closeout feedback', {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: existing ? AuditActionType.Update : AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'client_closeout_response',
        affectedId: response.id,
        metadata: { rating: response.rating, testimonialProvided: Boolean(response.testimonial), testimonialConsent: response.testimonialConsent },
      }, { prisma: tx, correlationId: `client-closeout-response:${response.id}:${response.updatedAt.toISOString()}`, actorId: actor.id });
      return this.mapClientResponse(response);
    });
  }

  async revokeTestimonialConsent(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'testimonial consent withdrawal', eventId);
    this.requireActorId(actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, eventId);
      await this.loadClientEvent(tx, eventId, actor);
      const existing = await tx.opsClientCloseoutResponse.findUnique({ where: { eventId } });
      if (!existing || existing.actorId !== actor.id) throw new NotFoundException('Client testimonial record not found');
      if (!existing.testimonialConsent) return this.mapClientResponse(existing);
      const response = await tx.opsClientCloseoutResponse.update({
        where: { eventId },
        data: { testimonialConsent: false, moderationStatus: 'withdrawn' },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Client withdrew testimonial consent', {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'client_closeout_response',
        affectedId: response.id,
        metadata: { testimonialConsent: false, withdrawnAt: new Date().toISOString() },
      }, { prisma: tx, correlationId: `testimonial-consent-withdrawn:${eventId}`, actorId: actor.id });
      return this.mapClientResponse(response);
    });
  }

  async getForModeration(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'client testimonial moderation', eventId);
    const response = await this.prisma.opsClientCloseoutResponse.findUnique({ where: { eventId } });
    return response ? { ...this.mapClientResponse(response), actorEmail: response.actorEmail } : null;
  }

  async moderateTestimonial(eventId: string, input: ClientTestimonialModerationInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'client testimonial moderation', eventId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, eventId);
      const response = await this.requireModeratableTestimonial(tx, eventId, input.action);
      const updated = await tx.opsClientCloseoutResponse.update({
        where: { eventId },
        data: { moderationStatus: input.action === 'approve' ? 'approved' : 'rejected' },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, input.action === 'approve' ? 'Approved client testimonial' : 'Rejected client testimonial', {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'client_closeout_response',
        affectedId: updated.id,
        metadata: { moderationStatus: updated.moderationStatus, reason: input.reason },
      }, { prisma: tx, correlationId: `client-testimonial-moderation:${eventId}`, actorId: actor.id });
      return { ...this.mapClientResponse(updated), actorEmail: updated.actorEmail };
    });
  }

  private async requireModeratableTestimonial(tx: Prisma.TransactionClient, eventId: string, action: ClientTestimonialModerationInput['action']) {
    const response = await tx.opsClientCloseoutResponse.findUnique({ where: { eventId } });
    if (!response) throw new NotFoundException('Client closeout response not found');
    const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { archived: true } });
    if (!event || event.archived) throw new BadRequestException('Archived testimonials cannot be moderated');
    if (response.moderationStatus !== 'pending') throw new BadRequestException('This testimonial has already been moderated or withdrawn');
    const hasConsentedTestimonial = response.testimonialConsent && Boolean(response.testimonial.trim());
    if (action === 'approve' && !hasConsentedTestimonial) throw new BadRequestException('Only a client-provided testimonial with explicit consent can be approved');
    return response;
  }

  private async loadClientEvent(prisma: Prisma.TransactionClient | PrismaService, eventId: string, actor: ResolvedEventOpsActor) {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
    if (!event) throw new NotFoundException('Event not found');
    await this.eventAccessPolicyService.requireCanReadEvent(actor, { ...event, inquiry: { email: event.inquiry.email } }, 'client event closeout');
    if (!isPrimaryClientContact(actor.email, event.inquiry.email)) throw new ForbiddenException('Only the primary client contact can access event closeout');
    return event;
  }

  private requireActorId(actor: ResolvedEventOpsActor) {
    if (!actor.id) throw new ForbiddenException('A verified client identity is required for this closeout action');
  }

  private mapDeliverableAck(document: { id: string; title: string; status: string; clientAcknowledgedAt: Date | null; clientAcknowledgementNote: string }) {
    return { id: document.id, title: document.title, status: document.status, acknowledgedAt: document.clientAcknowledgedAt?.toISOString() ?? null, note: document.clientAcknowledgementNote };
  }

  private mapWrapUpAck(wrapUp: { id: string; status: string; clientAcknowledgedAt: Date | null; clientAcknowledgementNote: string }) {
    return { id: wrapUp.id, status: wrapUp.status, acknowledgedAt: wrapUp.clientAcknowledgedAt?.toISOString() ?? null, note: wrapUp.clientAcknowledgementNote };
  }

  private mapClientResponse(response: { eventId: string; rating: number; feedback: string; testimonial: string; testimonialConsent: boolean; moderationStatus: string; submittedAt: Date }) {
    return { eventId: response.eventId, rating: response.rating, feedback: response.feedback, testimonial: response.testimonial, testimonialConsent: response.testimonialConsent, moderationStatus: response.moderationStatus, submittedAt: response.submittedAt.toISOString() };
  }

  private async lockEvent(tx: Prisma.TransactionClient, eventId: string) {
    // QUERY_AUDIT_RAW_SQL: serialize client closeout mutations against archive and concurrent acknowledgements.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.events WHERE id = ${eventId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Event not found');
  }
}
