import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { decisionLogQuerySchema, type PrismDecisionLogKind } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { EventReadModelQueries } from '../queries/event-read-models.queries';
import type { DecisionLogSources } from '../mappers/decision-log.mappers';
import { DecisionLogReadModelsService } from './decision-log-read-models.service';

const EVENT_ID = 'evt_decisions';
const at = (day: number) => new Date(`2026-09-${String(day).padStart(2, '0')}T09:00:00.000Z`);

function emptySources(overrides: Partial<DecisionLogSources> = {}): DecisionLogSources {
  return {
    event: {
      id: EVENT_ID,
      inquiryId: 'inq_1',
      clientName: 'Ana Reyes',
      clientPortalStatus: 'unlocked',
      archivedAt: null,
      archiveOverrideReason: null,
      archiveOverrideBy: null,
      updatedAt: at(1),
    },
    eventDecisions: [],
    freezeExceptions: [],
    addenda: [],
    complianceOverrides: [],
    riskChanges: [],
    ocularWaivers: [],
    billingCorrections: [],
    billingWaivers: [],
    paymentTermsOverrides: [],
    reassignments: [],
    inquiryMerges: [],
    auditAttributions: [],
    ...overrides,
  };
}

function audit(affectedType: string, affectedId: string, actor = 'Ms. Mys', actorRole = 'pmcm-admin', day = 1) {
  return { affectedType, affectedId, actor, actorRole, createdAt: at(day) };
}

/** One source row per kind, each dated on a distinct day so newest-first order is checkable. */
function everySource(): DecisionLogSources {
  return emptySources({
    event: { ...emptySources().event, archivedAt: at(13), archiveOverrideReason: 'Asset returns verified offline', archiveOverrideBy: 'Ms. Mys' },
    eventDecisions: [
      { id: 'dec_post', decision: 'postponed', reason: 'Venue flooding', actorName: 'Ms. Mys', actorRole: 'pmcm-admin', decidedAt: at(2) },
      { id: 'dec_cancel', decision: 'cancelled', reason: 'Client withdrew', actorName: 'Ms. Mys', actorRole: 'pmcm-admin', decidedAt: at(3) },
    ],
    freezeExceptions: [{ id: 'fx_1', requestedChange: 'Add photo booth', reason: 'Sponsor request', status: 'approved', decidedBy: 'Ms. Mys', decisionNote: 'Sponsor covers cost', decidedAt: at(4) }],
    addenda: [{ id: 'add_1', versionNumber: 2, title: 'Photo booth', summary: 'Adds booth after freeze exception', status: 'issued', financialDelta: 5000, issuedAt: at(5), _count: { impacts: 2 } }],
    complianceOverrides: [{ id: 'chk_1', title: 'Fire permit uploaded', status: 'overridden', overrideReason: 'Permit verified at city hall', overrideAt: at(6), overrideBy: 'Ms. Mys' }],
    riskChanges: [{ id: 'rh_1', riskId: 'risk_1', action: 'update', status: 'closed', severity: 'high', actor: 'Ms. Mys', reason: 'Generator backup confirmed', createdAt: at(7), risk: { title: 'Power outage' } }],
    ocularWaivers: [{ id: 'ocu_1', status: 'waived', waiverReason: 'Site plan already confirmed', waivedAt: at(8), waivedBy: 'Ms. Mys' }],
    billingCorrections: [{ id: 'corr_1', statementId: 'stmt_1', reason: 'Duplicate line', status: 'approved', correctedTotalAmount: 90000, resolvedBy: 'Ms. Mys', resolutionNotes: 'Duplicate catering line removed', resolvedAt: at(9) }],
    billingWaivers: [{ id: 'addbill_1', description: 'Overtime equipment', amount: 5000, status: 'waived', waiverReason: 'Goodwill for repeat client', waivedBy: 'Ms. Mys', waivedAt: at(10) }],
    paymentTermsOverrides: [{ id: 'bsrc_1', sourceLabel: 'Final proposal', status: 'approved', paymentTermsOverrideReason: 'Repeat client with approved credit terms', paymentTermsApprovedBy: 'Ms. Mys', approvedAt: at(11), createdAt: at(1) }],
    reassignments: [{ id: 'reassign_1', status: 'approved', reason: 'Coordinator ill', decisionReason: 'Backup coordinator available', decidedBy: 'Ms. Mys', decidedAt: at(12), fromOwnerRole: 'Floor Director', fromOwnerName: 'Rhea', toOwnerRole: 'Floor Director', toOwnerName: 'Taylor', task: { title: 'Stage check' } }],
    inquiryMerges: [{ id: 'merge_1', primaryInquiryId: 'inq_1', mergedInquiryId: 'inq_dup', matchBasis: 'organization', reason: 'Same organization, same date', actorName: 'Ms. Mys', actorRole: 'pmcm-admin', createdAt: at(14) }],
    auditAttributions: [
      audit('event', EVENT_ID),
      audit('freeze_exception', 'fx_1'),
      audit('addendum', 'add_1', 'Francis Ops', 'pmcm-admin'),
      audit('compliance_check', 'chk_1'),
      audit('compliance_risk', 'risk_1'),
      audit('ocular_visit_request', 'ocu_1'),
      audit('billing_correction', 'corr_1'),
      audit('additional_billing', 'addbill_1'),
      audit('billing_source', 'bsrc_1'),
      audit('event_task_reassignment', 'reassign_1'),
    ],
  });
}

function actor(role: string, extra: Partial<ResolvedEventOpsActor> = {}): ResolvedEventOpsActor {
  return { id: `user_${role}`, role, name: role === OpsUserRole.PmcmAdmin ? 'Ms. Mys' : 'Someone', explicit: true, verified: true, ...extra } as ResolvedEventOpsActor;
}

function createService(sources: DecisionLogSources | null = everySource()) {
  const queries = { decisionLogSourcesForEvent: vi.fn(async () => sources) } as unknown as EventReadModelQueries;
  const write = vi.fn(async () => undefined);
  const policy = new EventAccessPolicyService({ write, recordIntegrityIncident: vi.fn() } as never);
  return { service: new DecisionLogReadModelsService(queries, policy), queries, write };
}

const query = (input: Record<string, unknown> = {}) => decisionLogQuerySchema.parse(input);

describe('DecisionLogReadModelsService', () => {
  it.each<[PrismDecisionLogKind, string, { decision: string; reason: string; actor: { name: string | null; role: string | null } }]>([
    ['postponement', 'event_decision:dec_post', { decision: 'postponed', reason: 'Venue flooding', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['cancellation', 'event_decision:dec_cancel', { decision: 'cancelled', reason: 'Client withdrew', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['freeze_exception', 'freeze_exception:fx_1', { decision: 'approved', reason: 'Sponsor covers cost', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['addendum', 'addendum:add_1', { decision: 'issued', reason: 'Adds booth after freeze exception', actor: { name: 'Francis Ops', role: 'pmcm-admin' } }],
    ['archive_override', `event:${EVENT_ID}`, { decision: 'archived_with_override', reason: 'Asset returns verified offline', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['compliance_override', 'compliance_check:chk_1', { decision: 'overridden', reason: 'Permit verified at city hall', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['risk_change', 'compliance_risk_history:rh_1', { decision: 'updated: closed, high', reason: 'Generator backup confirmed', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['ocular_waiver', 'ocular_visit_request:ocu_1', { decision: 'waived', reason: 'Site plan already confirmed', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['billing_correction', 'billing_correction:corr_1', { decision: 'approved', reason: 'Duplicate catering line removed', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['billing_waiver', 'additional_billing:addbill_1', { decision: 'waived', reason: 'Goodwill for repeat client', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['payment_terms_override', 'billing_source:bsrc_1', { decision: 'approved', reason: 'Repeat client with approved credit terms', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['reassignment', 'event_task_reassignment:reassign_1', { decision: 'approved', reason: 'Backup coordinator available', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
    ['inquiry_merge', 'inquiry_merge:merge_1', { decision: 'merged', reason: 'Same organization, same date', actor: { name: 'Ms. Mys', role: 'pmcm-admin' } }],
  ])('maps the %s source with its dedicated reason and attributed actor', async (kind, id, expected) => {
    const { service } = createService();

    const log = await service.getDecisionLog(EVENT_ID, actor(OpsUserRole.PmcmAdmin), query({ kind }));

    expect(log.entries).toEqual([expect.objectContaining({ id, kind, ...expected, sourceRef: { type: id.split(':')[0], id: id.split(':')[1] } })]);
    expect(log.kindCounts[kind]).toBe(1);
  });

  it('composes every source newest first with stable totals and per-kind counts', async () => {
    const { service } = createService();

    const log = await service.getDecisionLog(EVENT_ID, actor(OpsUserRole.PmcmAdmin), query());

    expect(log.entries.map((item) => item.kind)).toEqual([
      'inquiry_merge', 'archive_override', 'reassignment', 'payment_terms_override', 'billing_waiver', 'billing_correction',
      'ocular_waiver', 'risk_change', 'compliance_override', 'addendum', 'freeze_exception', 'cancellation', 'postponement',
    ]);
    expect(log.page).toEqual({ index: 0, size: 25, total: 13, hasMore: false });
    expect(Object.values(log.kindCounts).every((count) => count === 1)).toBe(true);
  });

  it('pages the filtered list without overlap and keeps kind counts unfiltered', async () => {
    const { service } = createService();
    const pmcm = actor(OpsUserRole.PmcmAdmin);

    const first = await service.getDecisionLog(EVENT_ID, pmcm, query({ pageSize: 5 }));
    const third = await service.getDecisionLog(EVENT_ID, pmcm, query({ page: 2, pageSize: 5 }));
    const filtered = await service.getDecisionLog(EVENT_ID, pmcm, query({ kind: 'cancellation' }));

    expect(first.page).toEqual({ index: 0, size: 5, total: 13, hasMore: true });
    expect(third.entries.map((item) => item.kind)).toEqual(['freeze_exception', 'cancellation', 'postponement']);
    expect(third.page.hasMore).toBe(false);
    expect(first.entries.some((item) => third.entries.some((other) => other.id === item.id))).toBe(false);
    expect(filtered).toMatchObject({ kind: 'cancellation', page: { total: 1 }, kindCounts: { postponement: 1, inquiry_merge: 1 } });
  });

  it('omits the archive entry when the event was archived without an override and leaves unknown roles null', async () => {
    const { service } = createService(emptySources({
      event: { ...emptySources().event, archivedAt: at(5), archiveOverrideReason: '  ', archiveOverrideBy: null },
      ocularWaivers: [{ id: 'ocu_1', status: 'waived', waiverReason: 'Venue walkthrough done by video', waivedAt: at(8), waivedBy: 'Ms. Mys' }],
    }));

    const log = await service.getDecisionLog(EVENT_ID, actor(OpsUserRole.PmcmAdmin), query());

    expect(log.entries).toEqual([expect.objectContaining({ kind: 'ocular_waiver', actor: { name: 'Ms. Mys', role: null } })]);
  });

  it('returns 404 for an unknown event', async () => {
    const { service } = createService(null);

    await expect(service.getDecisionLog('evt_missing', actor(OpsUserRole.PmcmAdmin), query())).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([OpsUserRole.Coordinator, OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Guest, OpsUserRole.Unknown])(
    'forbids %s actors, audits the refusal, and never reads decision sources',
    async (role) => {
      const { service, queries, write } = createService();

      await expect(service.getDecisionLog(EVENT_ID, actor(role, { clientName: 'Ana Reyes', coordinatorId: 'coord_1' }), query())).rejects.toBeInstanceOf(ForbiddenException);

      expect(queries.decisionLogSourcesForEvent).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT_ID, action: '403 forbidden access: PMCM decision log' }));
    },
  );
});
