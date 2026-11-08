import type { ComplianceEvaluation, ComplianceEvaluationContext, ComplianceRuleDefinition } from './compliance-rule-registry';

/**
 * FR-06 Layer 2: conditional rules that apply only to one event type. Inquiry event types are free text,
 * so each group matches on keywords. Six groups with three rules each give the eighteen event-type rules.
 */
export const EVENT_TYPE_GROUPS = {
  wedding: { label: 'Weddings', keywords: ['wedding', 'nuptial'] },
  celebration: { label: 'Private celebrations', keywords: ['debut', 'birthday', 'anniversary', 'christening', 'baptism', 'party', 'reunion'] },
  corporate: { label: 'Corporate meetings', keywords: ['corporate', 'conference', 'seminar', 'summit', 'meeting', 'convention', 'town hall', 'forum', 'training'] },
  activation: { label: 'Launches and activations', keywords: ['launch', 'activation', 'exhibit', 'expo', 'trade show', 'roadshow', 'pop-up'] },
  public: { label: 'Concerts and public events', keywords: ['concert', 'festival', 'fun run', 'marathon', 'sports', 'fair', 'parade'] },
  gala: { label: 'Galas and awards', keywords: ['gala', 'award', 'ball', 'dinner'] },
} as const;
export type EventTypeGroup = keyof typeof EVENT_TYPE_GROUPS;

export function eventTypeGroupOf(eventType: string | undefined | null): EventTypeGroup | null {
  const value = (eventType ?? '').trim().toLowerCase();
  if (!value) return null;
  const match = (Object.keys(EVENT_TYPE_GROUPS) as EventTypeGroup[]).find((group) => EVENT_TYPE_GROUPS[group].keywords.some((keyword) => value.includes(keyword)));
  return match ?? null;
}

type Check = (context: ComplianceEvaluationContext) => ComplianceEvaluation;

const ok = (evidence: string): ComplianceEvaluation => ({ status: 'satisfied', evidence: [evidence] });
const missing = (evidence: string): ComplianceEvaluation => ({ status: 'not_satisfied', evidence: [evidence] });

const ACTIVE_ASSIGNMENTS = ['requested', 'quoted', 'accepted', 'confirmed', 'assigned'];

function supplierCheck(service: string, keywords: string[], confirmedOnly: boolean): Check {
  return (context) => {
    const matching = context.suppliers.filter((supplier) => keywords.some((keyword) => (supplier.category ?? '').toLowerCase().includes(keyword)));
    const statuses = confirmedOnly ? ['accepted', 'confirmed'] : ACTIVE_ASSIGNMENTS;
    const active = matching.filter((supplier) => statuses.includes(supplier.assignmentStatus.toLowerCase()));
    return active.length > 0
      ? ok(`${service}: ${active.map((supplier) => supplier.supplierName || supplier.id).join(', ')} (${active[0].assignmentStatus}).`)
      : missing(`No ${confirmedOnly ? 'confirmed' : 'active'} ${service.toLowerCase()} supplier among ${context.suppliers.length} supplier request(s).`);
  };
}

const guestRoster: Check = (context) => context.guestRosterCount > 0
  ? ok(`Guest roster has ${context.guestRosterCount} guest(s).`)
  : missing('The guest roster is empty.');

const program: Check = (context) => {
  const steps = context.briefings.reduce((count, briefing) => count + (Array.isArray(briefing.program) ? briefing.program.length : 0), 0);
  return steps > 0 ? ok(`The briefing program has ${steps} item(s).`) : missing('The briefing has no program or run of show.');
};

const venueType: Check = (context) => {
  const recorded = context.briefings.find((briefing) => briefing.venueType?.trim());
  return recorded ? ok(`Venue type is recorded as ${recorded.venueType}.`) : missing('No venue type is recorded in the briefing, so venue permits cannot be confirmed.');
};

const coverageDefined: Check = (context) => context.coverageRequirements.length > 0
  ? ok(`${context.coverageRequirements.length} coordinator coverage requirement(s) are set.`)
  : missing('No coordinator coverage requirement is set for crowd control.');

const catering = supplierCheck('Catering', ['cater', 'food'], true);
const audioVisual = supplierCheck('Audio-visual', ['av', 'audio', 'sound', 'light', 'tech', 'led'], false);

type RuleSpec = { key: string; title: string; severity: 'must_fix' | 'should_fix'; phases: string[]; remediation: string; check: Check };

const SPECS: Record<EventTypeGroup, RuleSpec[]> = {
  wedding: [
    { key: 'catering_confirmed', title: 'Catering is confirmed', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Confirm a catering supplier for the reception.', check: catering },
    { key: 'photo_video_assigned', title: 'Photo and video coverage is assigned', severity: 'should_fix', phases: ['planning', 'pre_event'], remediation: 'Request a photo or video supplier for the ceremony and reception.', check: supplierCheck('Photo and video', ['photo', 'video', 'film'], false) },
    { key: 'guest_roster_loaded', title: 'Guest list is loaded for seating', severity: 'must_fix', phases: ['pre_event'], remediation: 'Load the guest list so seating and check-in can be prepared.', check: guestRoster },
  ],
  celebration: [
    { key: 'catering_confirmed', title: 'Catering is confirmed', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Confirm a catering supplier.', check: catering },
    { key: 'guest_roster_loaded', title: 'Guest list is loaded', severity: 'must_fix', phases: ['pre_event'], remediation: 'Load the guest list before invitations and check-in.', check: guestRoster },
    { key: 'program_submitted', title: 'Program is in the briefing', severity: 'should_fix', phases: ['planning', 'pre_event'], remediation: 'Add the program (entrances, speeches, cake, games) to the briefing.', check: program },
  ],
  corporate: [
    { key: 'av_assigned', title: 'Audio-visual supplier is assigned', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Request an audio-visual supplier for presentations and sound.', check: audioVisual },
    { key: 'registration_roster_loaded', title: 'Attendee list is loaded for registration', severity: 'must_fix', phases: ['pre_event'], remediation: 'Load the attendee list so registration can check people in.', check: guestRoster },
    { key: 'program_submitted', title: 'Run of show is in the briefing', severity: 'should_fix', phases: ['planning', 'pre_event'], remediation: 'Add the agenda or run of show to the briefing.', check: program },
  ],
  activation: [
    { key: 'staging_assigned', title: 'Staging or fabrication supplier is assigned', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Request a staging, booth or fabrication supplier.', check: supplierCheck('Staging', ['stag', 'fabricat', 'booth', 'set', 'structure'], false) },
    { key: 'av_assigned', title: 'Audio-visual supplier is assigned', severity: 'should_fix', phases: ['planning', 'pre_event'], remediation: 'Request an audio-visual supplier for the reveal.', check: audioVisual },
    { key: 'venue_type_recorded', title: 'Venue type is recorded for permits', severity: 'should_fix', phases: ['planning'], remediation: 'Record whether the venue is a mall, hotel, open ground or other so permits can be planned.', check: venueType },
  ],
  public: [
    { key: 'security_assigned', title: 'Security supplier is assigned', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Request a security supplier for crowd control.', check: supplierCheck('Security', ['security', 'guard'], false) },
    { key: 'medical_assigned', title: 'Medical or first-aid team is assigned', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Request a medical, first-aid or ambulance supplier.', check: supplierCheck('Medical', ['medic', 'first aid', 'first-aid', 'ambulance', 'health'], false) },
    { key: 'crowd_coverage_defined', title: 'Coordinator coverage is set for crowd control', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Set coordinator coverage for entrances, exits and crowd areas.', check: coverageDefined },
  ],
  gala: [
    { key: 'catering_confirmed', title: 'Catering is confirmed', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Confirm a catering supplier for the dinner.', check: catering },
    { key: 'av_assigned', title: 'Audio-visual supplier is assigned', severity: 'must_fix', phases: ['planning', 'pre_event'], remediation: 'Request an audio-visual supplier for the awarding segments.', check: audioVisual },
    { key: 'program_submitted', title: 'Awards program is in the briefing', severity: 'should_fix', phases: ['planning', 'pre_event'], remediation: 'Add the awards program and segment order to the briefing.', check: program },
  ],
};

function toRule(group: EventTypeGroup, spec: RuleSpec): ComplianceRuleDefinition {
  const label = EVENT_TYPE_GROUPS[group].label;
  return {
    id: `compliance.event-type.${group}.${spec.key.replaceAll('_', '-')}`,
    conditionKey: `event_type_${group}_${spec.key}`,
    title: `${label}: ${spec.title}`,
    phases: spec.phases,
    severity: spec.severity,
    layer: spec.severity === 'must_fix' ? 'Must-Fix' : 'Should-Fix',
    scope: 'event_type',
    definitionStatus: 'PROVISIONAL',
    remediation: spec.remediation,
    evaluate: (context) => eventTypeGroupOf(context.inquiry?.eventType) === group
      ? spec.check(context)
      : { status: 'not_applicable', evidence: [`Applies to ${label.toLowerCase()} only; this event type is ${context.inquiry?.eventType || 'not set'}.`] },
  };
}

export const EVENT_TYPE_COMPLIANCE_RULES: readonly ComplianceRuleDefinition[] = (Object.keys(SPECS) as EventTypeGroup[])
  .flatMap((group) => SPECS[group].map((spec) => toRule(group, spec)));
