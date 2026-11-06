import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  proposalDraftInputSchema,
  proposalDraftResultSchema,
  type PrismVerifiedEventActor,
  type ProposalDraftInput,
  type ProposalDraftRequest,
  type ProposalDraftResponse,
} from '@prism/types';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import {
  PLATFORM_REFERENCE_READ_MODEL,
  type AiProposalEventSource,
  type PlatformReferenceReadModel,
} from '@prism/contexts/read-models';
import { aiRunFailureToHttpException } from './ai-run-failure';

const MS_PER_DAY = 86_400_000;

/** The model sees the event and the estimate being built, never the client's identity. */
export function buildProposalDraftInput(
  event: AiProposalEventSource,
  request: ProposalDraftRequest,
  now: Date,
): ProposalDraftInput {
  const lines = request.lines.map((line) => ({
    category: line.category,
    description: line.description,
    quantity: line.quantity,
    totalAmount: Math.round(line.quantity * line.unitAmount),
  }));
  const totalAmount = lines.reduce((sum, line) => sum + line.totalAmount, 0);
  return proposalDraftInputSchema.parse({
    eventId: event.id,
    eventName: event.eventName,
    eventType: event.eventType,
    eventDate: event.eventDate.toISOString().slice(0, 10),
    daysUntilEvent: Math.ceil((event.eventDate.getTime() - now.getTime()) / MS_PER_DAY),
    budgetAmount: request.budgetAmount,
    totalAmount,
    budgetAlignment: totalAmount <= request.budgetAmount ? 'within_budget' : 'over_budget',
    estimateNotes: request.notes,
    lines,
  });
}

/**
 * PMCM-only draft wording for a proposal (FR-AI-03). The draft is returned to the proposal form and
 * persisted nowhere. Issuing the proposal stays the human approval step.
 */
@Injectable()
export class ProposalDraftService {
  constructor(
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
    private readonly access: EventAccessPolicyService,
    @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly references: PlatformReferenceReadModel,
  ) {}

  async draft(
    request: ProposalDraftRequest,
    verifiedActor: PrismVerifiedEventActor,
    signal?: AbortSignal,
  ): Promise<ProposalDraftResponse> {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'proposal draft', request.eventId);
    const event = await this.references.findProposalDraftEventSource(request.eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.archived || event.clientPortalStatus === 'locked') {
      throw new BadRequestException('Proposals can only be drafted for an unlocked event');
    }

    const result = await this.aiGateway.run('proposal.draft', buildProposalDraftInput(event, request, new Date()), { signal });
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return {
      draft: proposalDraftResultSchema.parse(result.output),
      requestId: result.evidence.requestId,
      modelVersion: result.evidence.responseModel ?? result.evidence.requestedModel,
    };
  }
}
