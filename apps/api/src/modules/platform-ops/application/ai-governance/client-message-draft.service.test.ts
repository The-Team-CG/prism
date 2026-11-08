import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClientMessageDraftService, buildClientMessageDraftInput } from './client-message-draft.service';
import { activeClientMessageTriggers } from './client-message-triggers';

const NOW = new Date('2026-11-10T00:00:00.000Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

function facts(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: 'evt_1', eventName: 'Gala', eventType: 'Corporate gala', eventDate: day(30), archived: false, clientPortalStatus: 'unlocked',
      proposalClientStatus: 'pending', floorPlanStatus: 'in_review', floorPlanSubmittedAt: day(-2), clientEmail: 'ana@client.test',
      ...overrides,
    },
    latestIssuedProposal: { versionNumber: 2, issuedAt: day(-3) },
    nextUnpaidMilestone: { label: 'Balance', remainingBalance: 250_000, dueDate: day(1) },
  };
}

describe('FR-AI-09 client message triggers', () => {
  it('applies the catalog thresholds and stays quiet for archived or locked events', () => {
    expect(activeClientMessageTriggers(facts() as never, NOW).map((item) => item.trigger)).toEqual(['proposal_unanswered', 'balance_due', 'floorplan_pending']);
    const early = { ...facts(), latestIssuedProposal: { versionNumber: 2, issuedAt: day(-2) }, nextUnpaidMilestone: { label: 'Balance', remainingBalance: 1, dueDate: day(3) } };
    expect(activeClientMessageTriggers({ ...early, event: { ...early.event, floorPlanSubmittedAt: day(-1) } } as never, NOW)).toEqual([]);
    expect(activeClientMessageTriggers(facts({ archived: true }) as never, NOW)).toEqual([]);
    expect(activeClientMessageTriggers(facts({ clientPortalStatus: 'locked' }) as never, NOW)).toEqual([]);
  });

  it('gives the model the trigger facts but never the client identity', () => {
    const input = buildClientMessageDraftInput(facts() as never, 'balance_due', NOW);
    expect(input).toMatchObject({ trigger: 'balance_due', milestoneLabel: 'Balance', amountDue: 250_000, dueDate: '2026-11-11' });
    expect(JSON.stringify(input)).not.toMatch(/ana@client|Gala\b/);
  });
});

describe('ClientMessageDraftService', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });
  function setup(source = facts()) {
    const gateway = { run: vi.fn(async () => ({ outcome: 'completed', output: { subject: 'Your proposal', body: 'Hello' }, evidence: { requestId: 'req_1', requestedModel: 'm' } })) };
    const access = {
      resolveActor: (_: unknown, verified: { actorRole: string; actorName: string }) => ({ role: verified.actorRole, name: verified.actorName, id: 'usr' }),
      requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }),
    };
    const references = { findClientMessageTriggerFacts: vi.fn(async () => source) };
    const outbox = { write: vi.fn(async () => undefined) };
    const audit = { write: vi.fn(async () => undefined) };
    return { service: new ClientMessageDraftService(gateway as never, access as never, references as never, outbox as never, audit as never), gateway, outbox };
  }
  const pmcm = { actorRole: 'pmcm-admin', actorName: 'Maxine' } as never;
  const client = { actorRole: 'client', actorName: 'Ana' } as never;

  it('sends PMCM\'s edited message to the client email only while the trigger still applies', async () => {
    const f = setup();
    await f.service.send({ eventId: 'evt_1', trigger: 'floorplan_pending', subject: 'Floor plan', body: 'Please review.', idempotencyKey: 'k1' }, pmcm);
    expect(f.outbox.write).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'ana@client.test', message: 'Floor plan\n\nPlease review.' }), undefined);
    const stale = setup(facts({ floorPlanStatus: 'approved' }));
    await expect(stale.service.send({ eventId: 'evt_1', trigger: 'floorplan_pending', subject: 'Floor plan', body: 'Please review.', idempotencyKey: 'k2' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    expect(stale.outbox.write).not.toHaveBeenCalled();
  });

  it('refuses non-PMCM actors before calling the model', async () => {
    const f = setup();
    await expect(f.service.draft({ eventId: 'evt_1', trigger: 'proposal_unanswered' }, client)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.gateway.run).not.toHaveBeenCalled();
  });
});
