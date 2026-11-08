import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import {
  clientMessageDraftInputSchema,
  commsDraftResultSchema,
  type ClientMessageDraftInput,
  type ClientMessageDraftRequest,
  type ClientMessageTrigger,
  type PrismClientMessageTriggerState,
  type PrismVerifiedEventActor,
  type SendClientMessageInput,
} from '@prism/types';
import { PLATFORM_REFERENCE_READ_MODEL, type ClientMessageTriggerFacts, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import { NOTIFICATION_OUTBOX_WRITER } from '../../contracts/notifications/notification-ops.tokens';
import { writeNotification, type NotificationOutboxWriter } from '../../contracts/notifications/notification-outbox-writer.port';
import { aiRunFailureToHttpException } from './ai-run-failure';
import { activeClientMessageTriggers, isTriggerActive } from './client-message-triggers';

const DAY_MS = 86_400_000;

/** The model sees only the facts for one trigger; no client name, email or venue. */
export function buildClientMessageDraftInput(facts: ClientMessageTriggerFacts, trigger: ClientMessageTrigger, now: Date): ClientMessageDraftInput {
  const base = {
    trigger,
    eventType: facts.event.eventType,
    daysUntilEvent: Math.ceil((facts.event.eventDate.getTime() - now.getTime()) / DAY_MS),
  };
  if (trigger === 'proposal_unanswered' && facts.latestIssuedProposal) {
    return clientMessageDraftInputSchema.parse({ ...base, proposalVersion: facts.latestIssuedProposal.versionNumber, daysSinceProposalIssued: Math.floor((now.getTime() - facts.latestIssuedProposal.issuedAt.getTime()) / DAY_MS) });
  }
  if (trigger === 'balance_due' && facts.nextUnpaidMilestone) {
    return clientMessageDraftInputSchema.parse({ ...base, milestoneLabel: facts.nextUnpaidMilestone.label, amountDue: facts.nextUnpaidMilestone.remainingBalance, dueDate: facts.nextUnpaidMilestone.dueDate.toISOString().slice(0, 10) });
  }
  if (trigger === 'floorplan_pending' && facts.event.floorPlanSubmittedAt) {
    return clientMessageDraftInputSchema.parse({ ...base, daysSinceFloorPlanSubmitted: Math.floor((now.getTime() - facts.event.floorPlanSubmittedAt.getTime()) / DAY_MS) });
  }
  throw new BadRequestException('This follow-up does not apply to the event right now');
}

/**
 * FR-AI-09 for proposal, balance and floor plan follow-ups. Drafts are returned to PMCM, who edits and
 * sends them; nothing is sent automatically and the trigger must still apply when PMCM sends.
 */
@Injectable()
export class ClientMessageDraftService {
  constructor(
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
    private readonly access: EventAccessPolicyService,
    @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly references: PlatformReferenceReadModel,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  private async requirePmcm(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<ResolvedEventOpsActor> {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'client message draft', eventId);
    return actor;
  }

  private async facts(eventId: string) {
    const facts = await this.references.findClientMessageTriggerFacts(eventId);
    if (!facts) throw new NotFoundException('Event not found');
    return facts;
  }

  async triggers(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<PrismClientMessageTriggerState[]> {
    await this.requirePmcm(eventId, verifiedActor);
    return activeClientMessageTriggers(await this.facts(eventId), new Date());
  }

  async draft(request: ClientMessageDraftRequest, verifiedActor: PrismVerifiedEventActor, signal?: AbortSignal) {
    await this.requirePmcm(request.eventId, verifiedActor);
    const facts = await this.facts(request.eventId);
    const result = await this.aiGateway.run('client-message.draft', buildClientMessageDraftInput(facts, request.trigger, new Date()), { signal });
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return {
      draft: commsDraftResultSchema.parse(result.output),
      requestId: result.evidence.requestId,
      modelVersion: result.evidence.responseModel ?? result.evidence.requestedModel,
    };
  }

  async send(input: SendClientMessageInput, verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requirePmcm(input.eventId, verifiedActor);
    const facts = await this.facts(input.eventId);
    if (!isTriggerActive(facts, input.trigger, new Date())) throw new BadRequestException('This follow-up no longer applies to the event');
    if (!facts.event.clientEmail.trim()) throw new BadRequestException('The client has no email address on file');
    await writeNotification(this.notificationOutboxWriter, input.eventId, facts.event.clientEmail.trim(), `${input.subject}\n\n${input.body}`, 'email', {
      idempotencyKey: `client-message:${input.eventId}:${input.trigger}:${input.idempotencyKey}`,
    });
    await writeAudit(this.auditWriter, input.eventId, actor.name, `Sent client follow-up: ${input.trigger.replaceAll('_', ' ')}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Events,
      actionType: AuditActionType.Create,
      affectedType: 'client_message',
      affectedId: input.idempotencyKey,
      affectedLabel: input.subject,
      metadata: { trigger: input.trigger, feature: 'FR-AI-09', actorId: actor.id ?? null },
    });
    return { sent: true };
  }
}
