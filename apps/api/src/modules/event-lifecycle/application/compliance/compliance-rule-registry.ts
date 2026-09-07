export type ComplianceEvaluationStatus = 'satisfied' | 'not_satisfied' | 'not_applicable';

export type ComplianceEvaluation = {
  status: ComplianceEvaluationStatus;
  evidence: string[];
};

export type ComplianceEvaluationContext = {
  phase?: string;
  event: {
    id: string;
    status: string;
    eventDate: Date;
    walkInPolicy: string;
    walkInThreshold: number;
  };
  inquiry: { eventType: string } | null;
  briefings: Array<{ id: string }>;
  documents: Array<{ id: string; type: string; status: string }>;
  suppliers: Array<{
    id: string;
    supplierName: string;
    assignmentStatus: string;
    readinessStatus: string;
  }>;
  coverageRequirements: Array<{ role: string; required: number }>;
  coordinatorAssignments: Array<{ role: string; status: string; withdrawnAt: Date | null }>;
  billingSources: Array<{ id: string; status: string }>;
  fileRequirements: Array<{ key: string; status: string; detail: string }>;
  guestRosterCount: number;
};

export type ComplianceRuleDefinition = {
  id: string;
  conditionKey: string;
  title: string;
  phases: string[];
  severity: 'must_fix' | 'should_fix' | 'advisory';
  layer: 'Must-Fix' | 'Should-Fix' | 'Advisory';
  definitionStatus: 'DERIVED' | 'PROVISIONAL';
  remediation: string;
  evaluate: (context: ComplianceEvaluationContext, now: Date) => ComplianceEvaluation;
};

const applicable = (phases: string[], phase: string) => phases.includes(phase);

function satisfied(evidence: string[]): ComplianceEvaluation { return { status: 'satisfied', evidence }; }
function failed(evidence: string[]): ComplianceEvaluation { return { status: 'not_satisfied', evidence }; }
function notApplicable(evidence: string[]): ComplianceEvaluation { return { status: 'not_applicable', evidence }; }

export const COMPLIANCE_RULE_REGISTRY: readonly ComplianceRuleDefinition[] = [
  {
    id: 'compliance.lifecycle.phase-aligned', conditionKey: 'lifecycle_phase_aligned',
    title: 'Event lifecycle phase is aligned', phases: ['planning', 'pre_event', 'event_day', 'closure'],
    severity: 'must_fix', layer: 'Must-Fix', definitionStatus: 'DERIVED',
    remediation: 'Move the event to the requested lifecycle phase through its owning workflow.',
    evaluate: (context, now) => {
      const expected = { planning: ['planning'], pre_event: ['pre_event', 'ready'], event_day: ['event_day', 'live'], closure: ['closure', 'closed'] }[context.phase ?? 'planning'];
      if (!expected) return notApplicable([`No lifecycle status mapping is defined for phase ${context.phase ?? 'unknown'}.`]);
      return expected.includes(context.event.status.trim().toLowerCase())
        ? satisfied([`Persisted event status is ${context.event.status} for phase ${context.phase ?? 'planning'} as of ${now.toISOString()}.`])
        : failed([`Persisted event status is ${context.event.status || 'empty'}, expected one of ${expected.join(', ')}.`]);
    },
  },
  {
    id: 'compliance.onboarding.signed-conforme', conditionKey: 'signed_conforme',
    title: 'Signed conforme is recorded', phases: ['planning', 'pre_event', 'event_day', 'closure'],
    severity: 'must_fix', layer: 'Must-Fix', definitionStatus: 'DERIVED',
    remediation: 'Upload and accept the signed conforme in the event document vault.',
    evaluate: (context) => {
      const conforme = context.documents.filter((document) => document.type.toLowerCase().includes('conforme'));
      return conforme.some((document) => ['submitted', 'approved', 'accepted', 'complete'].includes(document.status.toLowerCase()))
        ? satisfied([`Document ${conforme.find((document) => ['submitted', 'approved', 'accepted', 'complete'].includes(document.status.toLowerCase()))?.id} is recorded with an accepted status.`])
        : failed([`No accepted conforme document found among ${context.documents.length} event document(s).`]);
    },
  },
  {
    id: 'compliance.onboarding.briefing-submitted', conditionKey: 'briefing_submitted',
    title: 'Event briefing is submitted', phases: ['planning', 'pre_event'],
    severity: 'should_fix', layer: 'Should-Fix', definitionStatus: 'DERIVED',
    remediation: 'Submit the current event briefing with venue, guest count, budget and service requirements.',
    evaluate: (context) => context.briefings.length > 0
      ? satisfied([`Persisted briefing count is ${context.briefings.length}.`])
      : failed(['No persisted event briefing is available.']),
  },
  {
    id: 'compliance.suppliers.readiness-confirmed', conditionKey: 'supplier_readiness_confirmed',
    title: 'Assigned suppliers confirm readiness', phases: ['pre_event', 'event_day'],
    severity: 'must_fix', layer: 'Must-Fix', definitionStatus: 'DERIVED',
    remediation: 'Confirm each supplier assignment and readiness, or withdraw the unready request through supplier operations.',
    evaluate: (context) => {
      if (context.suppliers.length === 0) return notApplicable(['No supplier quote requests are persisted for this event.']);
      const unready = context.suppliers.filter((supplier) =>
        !['confirmed', 'accepted'].includes(supplier.assignmentStatus.toLowerCase()) ||
        !['confirmed', 'ready'].includes(supplier.readinessStatus.toLowerCase()),
      );
      return unready.length === 0
        ? satisfied([`All ${context.suppliers.length} persisted supplier assignment(s) are confirmed and ready.`])
        : failed(unready.map((supplier) => `${supplier.supplierName || supplier.id}: assignment=${supplier.assignmentStatus}, readiness=${supplier.readinessStatus}.`));
    },
  },
  {
    id: 'compliance.staffing.coordinator-coverage', conditionKey: 'coordinator_coverage',
    title: 'Coordinator coverage meets requirements', phases: ['pre_event', 'event_day'],
    severity: 'must_fix', layer: 'Must-Fix', definitionStatus: 'DERIVED',
    remediation: 'Assign active coordinators, obtain acknowledgement, and replace withdrawn assignments until every required role is covered.',
    evaluate: (context) => {
      if (context.coverageRequirements.length === 0) return notApplicable(['No event coordinator coverage requirements are persisted.']);
      const deficits = context.coverageRequirements.map((requirement) => {
        const assigned = context.coordinatorAssignments.filter((assignment) => assignment.role.toLowerCase() === requirement.role.toLowerCase() && assignment.status.toLowerCase() !== 'withdrawn' && !assignment.withdrawnAt);
        const acknowledged = assigned.filter((assignment) => ['acknowledged', 'confirmed', 'accepted'].includes(assignment.status.toLowerCase())).length;
        return { requirement, acknowledged };
      }).filter(({ requirement, acknowledged }) => acknowledged < requirement.required);
      return deficits.length === 0
        ? satisfied(context.coverageRequirements.map((requirement) => `${requirement.role}: ${requirement.required} required coordinator(s) acknowledged.`))
        : failed(deficits.map(({ requirement, acknowledged }) => `${requirement.role}: ${acknowledged}/${requirement.required} acknowledged coordinator(s).`));
    },
  },
  {
    id: 'compliance.commercial.billing-source-approved', conditionKey: 'billing_source_approved',
    title: 'Billing source is approved', phases: ['planning', 'pre_event', 'closure'],
    severity: 'must_fix', layer: 'Must-Fix', definitionStatus: 'PROVISIONAL',
    remediation: 'Have PMCM approve the billing source before relying on its payment schedule.',
    evaluate: (context) => {
      if (context.billingSources.length === 0) return notApplicable(['No billing source is persisted for this event.']);
      const approved = context.billingSources.filter((source) => source.status.toLowerCase() === 'approved');
      return approved.length > 0
        ? satisfied([`Billing source ${approved[0].id} has persisted status approved.`])
        : failed([`Persisted billing source status(es): ${context.billingSources.map((source) => source.status).join(', ')}.`]);
    },
  },
  {
    id: 'compliance.files.required-items-complete', conditionKey: 'required_file_items_complete',
    title: 'Applicable file requirements are complete', phases: ['pre_event', 'closure'],
    severity: 'should_fix', layer: 'Should-Fix', definitionStatus: 'DERIVED',
    remediation: 'Resolve each applicable file requirement in the file requirements matrix or record a PMCM risk and mitigation.',
    evaluate: (context) => {
      if (context.fileRequirements.length === 0) return notApplicable(['The file requirements matrix returned no applicable items.']);
      const incomplete = context.fileRequirements.filter((item) => !['submitted', 'generated', 'approved', 'complete'].includes(item.status));
      return incomplete.length === 0
        ? satisfied([`All ${context.fileRequirements.length} file requirement item(s) are complete.`])
        : failed(incomplete.map((item) => `${item.key}: ${item.status} (${item.detail}).`));
    },
  },
  {
    id: 'compliance.guests.walk-in-policy-configured', conditionKey: 'guest_policy_configured',
    title: 'Guest walk-in policy is configured', phases: ['pre_event', 'event_day'],
    severity: 'advisory', layer: 'Advisory', definitionStatus: 'PROVISIONAL',
    remediation: 'Confirm the walk-in policy and threshold with PMCM before guest access opens.',
    evaluate: (context) => ['open', 'closed'].includes(context.event.walkInPolicy.toLowerCase()) && context.event.walkInThreshold > 0
      ? satisfied([`Persisted walk-in policy is ${context.event.walkInPolicy} with threshold ${context.event.walkInThreshold}; roster count is ${context.guestRosterCount}.`])
      : failed([`Persisted walk-in policy=${context.event.walkInPolicy || 'empty'}, threshold=${context.event.walkInThreshold}.`]),
  },
  {
    id: 'compliance.lifecycle.event-date-valid', conditionKey: 'event_date_relative_to_now',
    title: 'Event date is still actionable', phases: ['planning', 'pre_event'],
    severity: 'advisory', layer: 'Advisory', definitionStatus: 'PROVISIONAL',
    remediation: 'Confirm the event date or move the event through the appropriate lifecycle transition.',
    evaluate: (context, now) => context.event.eventDate.getTime() >= now.getTime()
      ? satisfied([`Persisted event date ${context.event.eventDate.toISOString()} is on or after evaluation time ${now.toISOString()}.`])
      : failed([`Persisted event date ${context.event.eventDate.toISOString()} is before evaluation time ${now.toISOString()}.`]),
  },
];

export function rulesForPhase(phase: string) {
  return COMPLIANCE_RULE_REGISTRY.filter((rule) => applicable(rule.phases, phase));
}

export function evaluateComplianceRule(rule: ComplianceRuleDefinition, context: ComplianceEvaluationContext, now: Date) {
  return rule.evaluate(context, now);
}

export function evaluateComplianceRuleForPhase(rule: ComplianceRuleDefinition, phase: string, context: ComplianceEvaluationContext, now: Date) {
  return rule.phases.includes(phase) ? rule.evaluate({ ...context, phase }, now) : notApplicable([`Rule is not applicable to lifecycle phase ${phase}.`]);
}
