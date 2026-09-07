import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_RULE_REGISTRY,
  evaluateComplianceRuleForPhase,
  type ComplianceEvaluationContext,
} from './compliance-rule-registry';

const base: ComplianceEvaluationContext = {
  phase: 'planning',
  event: { id: 'evt_1', status: 'planning', eventDate: new Date('2026-10-01T00:00:00.000Z'), walkInPolicy: 'closed', walkInThreshold: 200 },
  inquiry: { eventType: 'corporate' },
  briefings: [{ id: 'brief_1' }],
  documents: [{ id: 'doc_conforme', type: 'signed_conforme', status: 'accepted' }],
  suppliers: [{ id: 'sup_1', supplierName: 'Caterer', assignmentStatus: 'confirmed', readinessStatus: 'ready' }],
  coverageRequirements: [{ role: 'Lead', required: 1 }],
  coordinatorAssignments: [{ role: 'Lead', status: 'acknowledged', withdrawnAt: null }],
  billingSources: [{ id: 'bill_1', status: 'approved' }],
  fileRequirements: [{ key: 'signed_conforme', status: 'complete', detail: 'accepted' }],
  guestRosterCount: 10,
};

const past = new Date('2026-09-01T00:00:00.000Z');

function withFailure(key: string): ComplianceEvaluationContext {
  const context = structuredClone(base) as ComplianceEvaluationContext;
  if (key === 'lifecycle_phase_aligned') context.event.status = 'closure';
  if (key === 'signed_conforme') context.documents = [];
  if (key === 'briefing_submitted') context.briefings = [];
  if (key === 'supplier_readiness_confirmed') context.suppliers[0].readinessStatus = 'pending';
  if (key === 'coordinator_coverage') context.coordinatorAssignments = [];
  if (key === 'billing_source_approved') context.billingSources[0].status = 'draft';
  if (key === 'required_file_items_complete') context.fileRequirements[0].status = 'missing';
  if (key === 'guest_policy_configured') context.event.walkInThreshold = 0;
  if (key === 'event_date_relative_to_now') context.event.eventDate = new Date('2026-08-01T00:00:00.000Z');
  return context;
}

describe('compliance rule registry', () => {
  it.each(COMPLIANCE_RULE_REGISTRY)('$conditionKey has satisfied, failed and not-applicable outcomes', (rule) => {
    const phase = rule.phases[0];
    const satisfied = evaluateComplianceRuleForPhase(rule, phase, { ...base, phase }, past);
    const failed = evaluateComplianceRuleForPhase(rule, phase, { ...withFailure(rule.conditionKey), phase }, past);
    const notApplicable = evaluateComplianceRuleForPhase(rule, 'unknown_phase', base, past);
    expect(satisfied.status).toBe('satisfied');
    expect(failed.status).toBe('not_satisfied');
    expect(notApplicable.status).toBe('not_applicable');
    expect(satisfied.evidence.length).toBeGreaterThan(0);
    expect(failed.evidence.length).toBeGreaterThan(0);
    expect(notApplicable.evidence.length).toBeGreaterThan(0);
  });

  it('uses the injected clock for the date rule', () => {
    const rule = COMPLIANCE_RULE_REGISTRY.find((item) => item.conditionKey === 'event_date_relative_to_now')!;
    expect(evaluateComplianceRuleForPhase(rule, 'planning', base, new Date('2026-09-30T00:00:00.000Z')).status).toBe('satisfied');
    expect(evaluateComplianceRuleForPhase(rule, 'planning', base, new Date('2026-10-02T00:00:00.000Z')).status).toBe('not_satisfied');
  });
});
