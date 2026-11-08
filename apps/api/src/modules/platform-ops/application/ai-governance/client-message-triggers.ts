import type { ClientMessageTrigger, PrismClientMessageTriggerState } from '@prism/types';
import type { ClientMessageTriggerFacts } from '@prism/contexts/read-models';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** FR-AI-09 thresholds from the catalog. */
export const CLIENT_MESSAGE_TRIGGER_POLICY = {
  proposalUnansweredDays: 3,
  balanceDueWithinHours: 48,
  floorPlanPendingDays: 2,
} as const;

function wholeDays(from: Date, now: Date) {
  return Math.floor((now.getTime() - from.getTime()) / DAY_MS);
}

type TriggerCheck = (facts: ClientMessageTriggerFacts, now: Date) => PrismClientMessageTriggerState | null;

const proposalUnanswered: TriggerCheck = ({ event, latestIssuedProposal: proposal }, now) => {
  if (!proposal || event.proposalClientStatus !== 'pending') return null;
  const days = wholeDays(proposal.issuedAt, now);
  if (days < CLIENT_MESSAGE_TRIGGER_POLICY.proposalUnansweredDays) return null;
  return { trigger: 'proposal_unanswered', since: proposal.issuedAt.toISOString(), detail: `Proposal version ${proposal.versionNumber} unanswered for ${days} days` };
};

const balanceDue: TriggerCheck = ({ nextUnpaidMilestone: milestone }, now) => {
  if (!milestone) return null;
  const untilDue = milestone.dueDate.getTime() - now.getTime();
  if (untilDue < 0 || untilDue > CLIENT_MESSAGE_TRIGGER_POLICY.balanceDueWithinHours * HOUR_MS) return null;
  return { trigger: 'balance_due', since: milestone.dueDate.toISOString(), detail: `${milestone.label} of PHP ${milestone.remainingBalance.toLocaleString('en-PH')} due ${milestone.dueDate.toISOString().slice(0, 10)}` };
};

const floorPlanPending: TriggerCheck = ({ event }, now) => {
  if (event.floorPlanStatus !== 'in_review' || !event.floorPlanSubmittedAt) return null;
  const days = wholeDays(event.floorPlanSubmittedAt, now);
  if (days < CLIENT_MESSAGE_TRIGGER_POLICY.floorPlanPendingDays) return null;
  return { trigger: 'floorplan_pending', since: event.floorPlanSubmittedAt.toISOString(), detail: `Official floor plan awaiting approval for ${days} days` };
};

/** Which client follow-ups apply to the event right now. */
export function activeClientMessageTriggers(facts: ClientMessageTriggerFacts, now: Date): PrismClientMessageTriggerState[] {
  if (facts.event.archived || facts.event.clientPortalStatus !== 'unlocked') return [];
  return [proposalUnanswered, balanceDue, floorPlanPending]
    .map((check) => check(facts, now))
    .filter((item): item is PrismClientMessageTriggerState => item !== null);
}

export function isTriggerActive(facts: ClientMessageTriggerFacts, trigger: ClientMessageTrigger, now: Date) {
  return activeClientMessageTriggers(facts, now).some((item) => item.trigger === trigger);
}
