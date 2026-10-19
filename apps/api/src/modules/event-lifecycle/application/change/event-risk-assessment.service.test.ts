import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { recordEventRiskAssessmentSchema } from '@prism/types';
import { EventRiskAssessmentService, isLoweringRiskLevel, suggestRiskLevel } from './event-risk-assessment.service';

const pmcm = { id: 'pmcm_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true, verified: true } satisfies ResolvedEventOpsActor;

describe('suggested event risk level', () => {
  it('takes the highest severity among open compliance risks, and low when nothing is open', () => {
    expect(suggestRiskLevel([])).toBe('low');
    expect(suggestRiskLevel(['low', 'medium'])).toBe('medium');
    expect(suggestRiskLevel(['medium', 'high', 'low'])).toBe('high');
    expect(suggestRiskLevel(['critical', 'low'])).toBe('critical');
  });

  it('counts an unrecognised severity as medium so it never reads as low', () => {
    expect(suggestRiskLevel(['must_fix'])).toBe('medium');
    expect(suggestRiskLevel(['low', 'unclassified'])).toBe('medium');
  });

  it('treats only a lower level than the recorded one as lowering', () => {
    expect(isLoweringRiskLevel('critical', 'medium')).toBe(true);
    expect(isLoweringRiskLevel('medium', 'medium')).toBe(false);
    expect(isLoweringRiskLevel('low', 'high')).toBe(false);
    expect(isLoweringRiskLevel(null, 'low')).toBe(false);
  });
});

type Row = Record<string, any>;

/** Stateful fake for the risk tables; compliance risks are filtered by the same where clause the service sends. */
function fakeStore(options: { risks?: Array<{ severity: string; status: string }>; assessment?: Row | null } = {}) {
  const risks = options.risks ?? [];
  const assessments = new Map<string, Row>(options.assessment ? [[options.assessment.id, { ...options.assessment, history: [] as Row[] }]] : []);
  const history: Row[] = [];
  const prisma = {
    opsEvent: { findUnique: async () => ({ id: 'evt_1', archived: false }) },
    opsComplianceRisk: { findMany: vi.fn(async ({ where }: { where: { status: string } }) => risks.filter((risk) => risk.status === where.status)) },
    opsEventRiskAssessment: {
      findUnique: vi.fn(async ({ where }: { where: { eventId: string } }) => {
        const row = [...assessments.values()].find((item) => item.eventId === where.eventId);
        return row ? { ...row, history: history.filter((entry) => entry.assessmentId === row.id).sort((a, b) => b.revision - a.revision) } : null;
      }),
      create: vi.fn(async ({ data }: { data: Row }) => { assessments.set(data.id, { ...data }); return data; }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = assessments.get(where.id);
        if (!row || row.revision !== where.revision) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    opsEventRiskAssessmentHistory: { create: vi.fn(async ({ data }: { data: Row }) => { history.push(data); return data; }) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
  };
  const audit = { write: vi.fn(async () => undefined) };
  const service = new EventRiskAssessmentService(prisma as unknown as PrismaService, new EventAccessPolicyService(audit as unknown as AuditWriter), audit as unknown as AuditWriter);
  return { service, history, audit, assessments, prisma };
}

const record = (overrides: Record<string, unknown>) => recordEventRiskAssessmentSchema.parse({ level: 'medium', summary: 'Venue access is uncertain', expectedRevision: 0, ...overrides });

describe('EventRiskAssessmentService', () => {
  it('shows the suggestion from open risks beside the level PMCM records, and ignores closed risks', async () => {
    const { service } = fakeStore({ risks: [{ severity: 'critical', status: 'closed' }, { severity: 'high', status: 'open' }, { severity: 'medium', status: 'open' }] });

    const view = await service.getAssessment('evt_1', pmcm);

    expect(view).toMatchObject({ suggestedLevel: 'high', openRiskCounts: { low: 0, medium: 1, high: 1, critical: 0 }, assessment: null, history: [] });
  });

  it('records the authoritative level, keeps every revision, and audits the change', async () => {
    const { service, history, audit } = fakeStore({ risks: [{ severity: 'high', status: 'open' }] });

    const first = await service.recordAssessment('evt_1', record({ level: 'high', mitigations: 'Backup access route agreed', expectedRevision: 0 }), pmcm);
    const second = await service.recordAssessment('evt_1', record({ level: 'high', summary: 'Access route confirmed', expectedRevision: 1 }), pmcm);

    expect(first.assessment).toMatchObject({ level: 'high', revision: 1, mitigations: 'Backup access route agreed' });
    expect(second.assessment).toMatchObject({ level: 'high', revision: 2, summary: 'Access route confirmed' });
    expect(second.history.map((entry) => [entry.revision, entry.suggestedLevel])).toEqual([[2, 'high'], [1, 'high']]);
    expect(history).toHaveLength(2);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1', action: 'Recorded event risk level', actor: 'PMCM Admin' }), expect.anything());
  });

  it('requires a reason when PMCM lowers the recorded level, and keeps that reason in history', async () => {
    const { service } = fakeStore();
    await service.recordAssessment('evt_1', record({ level: 'critical', expectedRevision: 0 }), pmcm);

    await expect(service.recordAssessment('evt_1', record({ level: 'medium', expectedRevision: 1 }), pmcm)).rejects.toBeInstanceOf(BadRequestException);
    const lowered = await service.recordAssessment('evt_1', record({ level: 'medium', expectedRevision: 1, reason: 'Venue confirmed the access route in writing' }), pmcm);

    expect(lowered.history[0]).toMatchObject({ revision: 2, level: 'medium', previousLevel: 'critical', reason: 'Venue confirmed the access route in writing' });
  });

  it('rejects a write made against a revision that has since changed', async () => {
    const { service, history } = fakeStore();
    await service.recordAssessment('evt_1', record({ level: 'low', expectedRevision: 0 }), pmcm);

    await expect(service.recordAssessment('evt_1', record({ level: 'high', expectedRevision: 0 }), pmcm)).rejects.toBeInstanceOf(ConflictException);
    expect(history).toHaveLength(1);
  });

  it('keeps the risk level and its history from clients, suppliers, coordinators, and guests', async () => {
    const { service, prisma, audit } = fakeStore({ assessment: { id: 'risk_1', eventId: 'evt_1', level: 'high', summary: 'x', mitigations: '', revision: 1, assessedBy: 'PMCM Admin', assessedAt: new Date() } });
    const denied: ResolvedEventOpsActor[] = [
      { id: 'client_1', role: OpsUserRole.Client, name: 'Client', explicit: true, verified: true, email: 'client@example.com' },
      { id: 'coord_1', role: OpsUserRole.Coordinator, name: 'Coordinator', explicit: true, verified: true, eventId: 'evt_1' },
      { id: 'sup_1', role: OpsUserRole.Supplier, name: 'Supplier', explicit: true, verified: true },
      { id: 'guest_1', role: OpsUserRole.Guest, name: 'Guest', explicit: true, verified: true },
    ];

    for (const actor of denied) {
      await expect(service.getAssessment('evt_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.recordAssessment('evt_1', record({ level: 'low', expectedRevision: 1 }), actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(prisma.opsEventRiskAssessment.updateMany).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: '403 forbidden access: event risk assessment', eventId: 'evt_1' }));
  });
});
