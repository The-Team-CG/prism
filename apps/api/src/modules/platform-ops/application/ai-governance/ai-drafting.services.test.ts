import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { AiAuditEvidence, AiGatewayRunFailure, PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { InquiryTriageService, buildInquiryTriageInput } from './inquiry-triage.service';
import { ProposalDraftService, buildProposalDraftInput } from './proposal-draft.service';

const NOW = new Date('2026-11-06T00:00:00.000Z');

const INQUIRY_SOURCE = {
  id: 'inq_1',
  status: 'new',
  eventType: 'Corporate gala',
  clientType: 'corporate',
  eventDate: new Date('2026-12-16T00:00:00.000Z'),
  hasOrganization: true,
  source: 'Referral',
  referralDetails: 'Referred by a past client',
  message: 'We need a venue for about 200 guests. Reach me at jane@acme.test or 0917 123 4567.',
  duplicateInquiryCount: 1,
  previouslyDeclined: false,
};

const EVENT_SOURCE = {
  id: 'evt_1',
  eventName: 'Acme Year-End Gala',
  eventType: 'Corporate gala',
  eventDate: new Date('2026-12-16T00:00:00.000Z'),
  archived: false,
  clientPortalStatus: 'unlocked',
};

const ESTIMATE_REQUEST = {
  eventId: 'evt_1',
  budgetAmount: 500_000,
  notes: 'Client prefers an outdoor venue',
  lines: [
    { category: 'Venue', description: 'Garden venue', quantity: 1, unitAmount: 300_000 },
    { category: 'Catering', description: 'Buffet per head', quantity: 100, unitAmount: 1_500 },
  ],
};

function actor(role: string) {
  return { actorId: 'user_1', actorRole: role, actorName: 'Verified PMCM' } as unknown as PrismVerifiedEventActor;
}

function policy() {
  return {
    resolveActor: vi.fn((_input: unknown, verified: { actorId: string; actorRole: string; actorName: string }) => ({
      id: verified.actorId,
      role: verified.actorRole,
      name: verified.actorName,
    })),
    requireActorRole: vi.fn(async (resolved: { role: string }, roles: string[]) => {
      if (!roles.includes(resolved.role)) throw new ForbiddenException('PMCM role required');
    }),
  };
}

function evidence(useCaseId: AiAuditEvidence['useCaseId']): AiAuditEvidence {
  return {
    requestId: 'req_1',
    useCaseId,
    promptVersion: 'v1',
    profileId: 'anthropic-zdr',
    provider: 'anthropic',
    requestedModel: 'claude-sonnet-5-5',
    routeRevision: 'a'.repeat(64),
    routePolicyOutcome: 'zdr_approved',
    zdrBasis: 'provider-enforced',
    dataClasses: ['internal', 'personal'],
    latencyMs: 5,
    outcome: 'completed',
    approvalState: 'pending',
  } as AiAuditEvidence;
}

function blocked(code: AiGatewayRunFailure['error']['code']): AiGatewayRunFailure {
  return {
    outcome: 'blocked',
    error: { code, message: 'blocked', retryable: false },
    evidence: { ...evidence('inquiry.triage'), outcome: 'blocked' },
  };
}

const TRIAGE_OUTPUT = {
  fit: 'high',
  summary: 'A clear corporate request.',
  signals: ['Referral'],
  risks: [],
  suggestedAction: 'accept',
  suggestedQuestions: ['Confirm the guest count'],
};

describe('inquiry triage', () => {
  it('sends the model the inquiry wording but no applicant identity', () => {
    const input = buildInquiryTriageInput(
      { ...INQUIRY_SOURCE, message: 'x'.repeat(5_000), referralDetails: 'y'.repeat(2_000) },
      NOW,
    );
    expect(Object.keys(input).sort()).toEqual([
      'clientType', 'daysUntilEvent', 'duplicateInquiryCount', 'eventDate', 'eventType', 'hasOrganization',
      'inquiryId', 'message', 'previouslyDeclined', 'referralDetails', 'source',
    ]);
    expect(input.eventDate).toBe('2026-12-16');
    expect(input.daysUntilEvent).toBe(40);
    expect(input.message).toHaveLength(4_000);
    expect(input.referralDetails).toHaveLength(1_000);
  });

  function setup(gatewayResult: unknown, source: typeof INQUIRY_SOURCE | null = INQUIRY_SOURCE) {
    const prisma = {
      opsAiApprovalRecord: { create: vi.fn(async ({ data }: { data: unknown }) => data), findFirst: vi.fn() },
    };
    const gateway = { run: vi.fn(async () => gatewayResult), stream: vi.fn() };
    const references = { findInquiryTriageSource: vi.fn(async () => source) };
    const service = new InquiryTriageService(prisma as never, gateway as never, policy() as never, references as never);
    return { service, prisma, gateway };
  }

  it('stores advice as an advisory record linked to the gateway audit row', async () => {
    const { service, prisma, gateway } = setup({ outcome: 'completed', output: TRIAGE_OUTPUT, evidence: evidence('inquiry.triage') });

    const review = await service.run({ inquiryId: 'inq_1' }, actor('pmcm-admin'));

    expect(gateway.run).toHaveBeenCalledWith('inquiry.triage', expect.objectContaining({ inquiryId: 'inq_1' }), expect.anything());
    expect(prisma.opsAiApprovalRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aiAuditLogId: 'aia_req_1',
        featureName: 'FR-AI-01',
        status: 'advisory',
        humanApproved: false,
        sourceDispatchId: 'inquiry-triage:inq_1:req_1',
        reviewPayload: { inquiryId: 'inq_1', result: TRIAGE_OUTPUT },
      }),
    });
    expect(review).toMatchObject({ inquiryId: 'inq_1', result: TRIAGE_OUTPUT, requestId: 'req_1', requestedBy: 'Verified PMCM' });
  });

  it('refuses non-PMCM actors before reading the inquiry or calling the provider', async () => {
    const { service, gateway, prisma } = setup({ outcome: 'completed', output: TRIAGE_OUTPUT, evidence: evidence('inquiry.triage') });
    await expect(service.run({ inquiryId: 'inq_1' }, actor('client'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.latest('inq_1', actor('supplier'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(gateway.run).not.toHaveBeenCalled();
    expect(prisma.opsAiApprovalRecord.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown inquiry without calling the provider', async () => {
    const { service, gateway } = setup(null, null);
    await expect(service.run({ inquiryId: 'missing' }, actor('pmcm-admin'))).rejects.toBeInstanceOf(NotFoundException);
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('reports a missing provider as unavailable and stores nothing', async () => {
    const { service, prisma } = setup(blocked('use_case_disabled'));
    await expect(service.run({ inquiryId: 'inq_1' }, actor('pmcm-admin'))).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: expect.stringContaining('no AI provider is configured'),
    });
    expect(prisma.opsAiApprovalRecord.create).not.toHaveBeenCalled();
  });

  it('ignores a stored record whose payload no longer matches the contract', async () => {
    const { service, prisma } = setup(null);
    prisma.opsAiApprovalRecord.findFirst.mockResolvedValue({
      id: 'r1', requestedAt: NOW, requestedBy: 'x', reviewPayload: { result: { fit: 'nonsense' } },
      auditLog: { requestId: 'req_1', modelVersion: 'm' },
    });
    await expect(service.latest('inq_1', actor('pmcm-admin'))).resolves.toBeNull();
  });
});

describe('proposal drafting', () => {
  it('sends the estimate totals and budget outcome but no client identity', () => {
    const input = buildProposalDraftInput(EVENT_SOURCE, ESTIMATE_REQUEST, NOW);
    expect(input).toMatchObject({ totalAmount: 450_000, budgetAmount: 500_000, budgetAlignment: 'within_budget', eventDate: '2026-12-16' });
    expect(input.lines.map((line) => line.totalAmount)).toEqual([300_000, 150_000]);
    expect(JSON.stringify(input)).not.toMatch(/clientName|email|phone/i);

    const over = buildProposalDraftInput(EVENT_SOURCE, { ...ESTIMATE_REQUEST, budgetAmount: 400_000 }, NOW);
    expect(over.budgetAlignment).toBe('over_budget');
  });

  it('computes payment schedule amounts on the server so they always sum to the estimate total', () => {
    expect(buildProposalDraftInput(EVENT_SOURCE, ESTIMATE_REQUEST, NOW).paymentSchedule).toEqual([
      { label: 'Downpayment', percentage: 50, amount: 225_000 },
      { label: 'Balance before the event', percentage: 50, amount: 225_000 },
    ]);
    const thirds = buildProposalDraftInput(EVENT_SOURCE, {
      ...ESTIMATE_REQUEST,
      lines: [{ category: 'Venue', description: 'Hall', quantity: 1, unitAmount: 100_001 }],
      paymentSchedule: [{ label: 'Downpayment', percentage: 50 }, { label: 'Second', percentage: 25 }, { label: 'Balance', percentage: 25 }],
    }, NOW).paymentSchedule;
    expect(thirds.map((item) => item.amount)).toEqual([50_000, 25_000, 25_001]);
  });

  function setup(gatewayResult: unknown, source: typeof EVENT_SOURCE | null = EVENT_SOURCE) {
    const gateway = { run: vi.fn(async () => gatewayResult), stream: vi.fn() };
    const references = { findProposalDraftEventSource: vi.fn(async () => source) };
    const access = policy();
    const service = new ProposalDraftService(gateway as never, access as never, references as never);
    return { service, gateway, access };
  }

  const DRAFT = {
    title: 'Garden gala package',
    summary: 'A warm summary.',
    revisionNote: '',
    highlights: ['Garden venue'],
    sections: {
      executiveSummary: 'A garden gala for 200 guests.',
      eventConcept: 'An evening in the garden.',
      servicePackageSummary: 'Venue and catering.',
      investmentSummary: 'PHP 450,000, within budget.',
      paymentSchedule: 'Downpayment 50% (PHP 225,000); balance 50% (PHP 225,000).',
    },
  };

  it('returns the draft to the caller and persists nothing', async () => {
    const { service, gateway } = setup({ outcome: 'completed', output: DRAFT, evidence: evidence('proposal.draft') });
    await expect(service.draft(ESTIMATE_REQUEST, actor('pmcm-admin'))).resolves.toEqual({
      draft: DRAFT,
      requestId: 'req_1',
      modelVersion: 'claude-sonnet-5-5',
    });
    expect(gateway.run).toHaveBeenCalledWith('proposal.draft', expect.objectContaining({ totalAmount: 450_000 }), expect.anything());
  });

  it('refuses non-PMCM actors before touching the provider', async () => {
    const { service, gateway } = setup({ outcome: 'completed', output: DRAFT, evidence: evidence('proposal.draft') });
    await expect(service.draft(ESTIMATE_REQUEST, actor('client'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('refuses archived or locked events and unknown events', async () => {
    await expect(setup(null, null).service.draft(ESTIMATE_REQUEST, actor('pmcm-admin'))).rejects.toBeInstanceOf(NotFoundException);
    for (const patch of [{ archived: true }, { clientPortalStatus: 'locked' }]) {
      const { service, gateway } = setup(null, { ...EVENT_SOURCE, ...patch });
      await expect(service.draft(ESTIMATE_REQUEST, actor('pmcm-admin'))).rejects.toBeInstanceOf(BadRequestException);
      expect(gateway.run).not.toHaveBeenCalled();
    }
  });

  it('tells PMCM when the route is not approved for real data', async () => {
    const { service } = setup(blocked('zdr_required'));
    await expect(service.draft(ESTIMATE_REQUEST, actor('pmcm-admin'))).rejects.toMatchObject({
      message: expect.stringContaining('not approved for real event data'),
    });
  });
});
