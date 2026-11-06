import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditService, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { AuditWriterAdapter } from '@prism/contexts/platform-ops';
import { ComplianceWorkflowService } from './compliance-workflow.service';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';

function createService() {
  const state = {
    event: { id: 'evt_sample', inquiryId: 'inq_sample', readiness: 'Planning' },
    inquiry: { id: 'inq_sample', eventType: 'corporate' },
    rules: [
      {
        id: 'rule_must',
        eventId: null,
        eventType: 'corporate',
        phase: 'planning',
        severity: 'must_fix',
        layer: 'Must-Fix',
        conditionKey: 'supplier_contracts',
        title: 'Supplier contracts ready',
        note: 'Attach final quotation.',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_other_phase',
        eventId: null,
        eventType: 'corporate',
        phase: 'closure',
        severity: 'advisory',
        layer: 'Advisory',
        conditionKey: 'post_event_photos',
        title: 'Post-event photos',
        note: 'Collect photos.',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any[],
    checks: [] as any[],
    risks: [] as any[],
    riskHistory: [] as any[],
  };
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async ({ where }) => (where.id === state.event.id ? state.event : null)),
      update: vi.fn(async ({ data }) => Object.assign(state.event, data)),
    },
    opsInquiry: { findUnique: vi.fn(async () => state.inquiry) },
    opsBriefing: { findMany: vi.fn(async () => [{ id: 'briefing_1' }]) },
    opsDocument: { findMany: vi.fn(async () => [{ id: 'doc_1', type: 'conforme', status: 'accepted' }]) },
    opsComplianceRule: {
      findMany: vi.fn(async ({ where }) =>
        state.rules.filter((rule) => rule.active === where.active && rule.phase === where.phase),
      ),
    },
    opsComplianceCheck: {
      deleteMany: vi.fn(async () => {
        const count = state.checks.length;
        state.checks = [];
        return { count };
      }),
      createMany: vi.fn(async ({ data }) => {
        state.checks.push(...data.map((item: any) => ({ ...item, createdAt: new Date() })));
        return { count: data.length };
      }),
      findMany: vi.fn(async () => state.checks),
      update: vi.fn(async ({ where, data }) => {
        const check = state.checks.find((item) => item.id === where.id);
        if (!check) throw new Error('missing check');
        Object.assign(check, data);
        return check;
      }),
    },
    opsComplianceRisk: {
      create: vi.fn(async ({ data }) => {
        const risk = { ...data, createdAt: new Date(), updatedAt: new Date() };
        state.risks.push(risk);
        return risk;
      }),
      findFirst: vi.fn(async ({ where }) => state.risks.find((risk) => risk.id === where.id && risk.eventId === where.eventId) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const risk = state.risks.find((item) => item.id === where.id)!;
        Object.assign(risk, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
        return risk;
      }),
    },
    opsComplianceRiskHistory: { create: vi.fn(async ({ data }) => { state.riskHistory.push(data); return data; }) },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const auditService = new AuditService(prisma as any);
  auditService.audit = vi.fn(async () => undefined) as any;
  const auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma as any, auditService));
  const accessPolicy = new EventAccessPolicyService({ write: vi.fn() });
  const commercialFactsReader = { getLifecycleFacts: vi.fn(async () => ({ supplierQuoteRequests: [{ id: 'request_1', supplierName: 'Sound', assignmentStatus: 'confirmed', readinessStatus: 'ready' }], billingSources: [{ id: 'source_1', status: 'approved' }], supplierReviews: [], billingStatements: [], paymentMilestones: [] })) };
  const lifecycleFactsReader = { getComplianceFacts: vi.fn(async () => ({ coverageRequirements: [{ role: 'Lead', required: 1 }], coordinatorAssignments: [{ role: 'Lead', status: 'acknowledged', withdrawnAt: null }], guestRosterCount: 12 })) };
  const service = new ComplianceWorkflowService(prisma as any, auditWriter, accessPolicy, new WorkflowCommandService(), commercialFactsReader as any, lifecycleFactsReader as any);
  return { service, state, auditService, commercialFactsReader, lifecycleFactsReader };
}

describe('ComplianceWorkflowService', () => {
  it('composes owner-scoped cross-domain facts into the compliance evaluation context', async () => {
    const { service, commercialFactsReader, lifecycleFactsReader } = createService();

    const context = await (service as any).loadContext('evt_sample');

    expect(context).toMatchObject({
      suppliers: [{ id: 'request_1', supplierName: 'Sound' }],
      billingSources: [{ id: 'source_1', status: 'approved' }],
      coverageRequirements: [{ role: 'Lead', required: 1 }],
      coordinatorAssignments: [{ role: 'Lead', status: 'acknowledged' }],
      guestRosterCount: 12,
    });
    expect(commercialFactsReader.getLifecycleFacts).toHaveBeenCalledWith('evt_sample');
    expect(lifecycleFactsReader.getComplianceFacts).toHaveBeenCalledWith('evt_sample');
  });

  it('generates matching compliance checks and updates readiness in one workflow command', async () => {
    const { service, state, auditService } = createService();

    const checks = await service.runCompliance('evt_sample', { phase: 'planning' }, { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ ruleId: 'rule_must', status: 'open', title: 'Supplier contracts ready' });
    expect(state.event.readiness).toBe('Must-Fix item open');
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'PMCM Admin',
      'Ran compliance checks',
      expect.objectContaining({ metadata: expect.objectContaining({ ruleCount: 1 }) }),
      undefined,
    );
  });

  describe('risk likelihood and impact', () => {
    const admin = { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
    const base = { phase: 'closure', title: 'Generator failure', status: 'open' as const };

    it('derives severity from likelihood and impact, records both, and keeps them in history', async () => {
      const { service, state } = createService();

      const risk = await service.createComplianceRisk('evt_sample', { ...base, likelihood: 'high', impact: 'high' }, admin);

      expect(risk).toMatchObject({ severity: 'critical', likelihood: 'high', impact: 'high' });
      expect(state.riskHistory[0]).toMatchObject({ riskId: risk.id, severity: 'critical', likelihood: 'high', impact: 'high' });
    });

    it('lets an explicit severity win and falls back to medium when nothing was rated', async () => {
      const { service } = createService();

      expect(await service.createComplianceRisk('evt_sample', { ...base, severity: 'low', likelihood: 'high', impact: 'high' }, admin))
        .toMatchObject({ severity: 'low' });
      expect(await service.createComplianceRisk('evt_sample', base, admin))
        .toMatchObject({ severity: 'medium', likelihood: null, impact: null });
    });

    it('re-derives severity on update from the new rating and the stored one, and ignores a lone rating with no partner', async () => {
      const { service } = createService();
      const unrated = await service.createComplianceRisk('evt_sample', base, admin);
      const rated = await service.createComplianceRisk('evt_sample', { ...base, likelihood: 'low', impact: 'low' }, admin);

      expect((await service.updateComplianceRisk('evt_sample', unrated.id, { impact: 'high' }, admin)).severity).toBe('medium');
      expect((await service.updateComplianceRisk('evt_sample', rated.id, { impact: 'high' }, admin)).severity).toBe('medium');
      expect((await service.updateComplianceRisk('evt_sample', rated.id, { likelihood: 'high' }, admin)).severity).toBe('critical');
    });

    it('refuses to update a risk that belongs to another event', async () => {
      const { service } = createService();
      const risk = await service.createComplianceRisk('evt_sample', base, admin);

      await expect(service.updateComplianceRisk('evt_other', risk.id, { impact: 'high' }, admin)).rejects.toThrow('Risk not found');
    });
  });

  it('requires override reason before overriding a compliance check', async () => {
    const { service, state } = createService();
    state.checks.push({ id: 'chk_sample', eventId: 'evt_sample', title: 'Supplier contracts ready', status: 'open' });

    await expect(service.resolveCompliance('evt_sample', 'chk_sample', { action: 'override' }, { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('denies supplier actors from compliance rule reads', async () => {
    const { service } = createService();

    await expect(
      service.listComplianceRules({ role: 'supplier', name: 'Supplier', explicit: true } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
