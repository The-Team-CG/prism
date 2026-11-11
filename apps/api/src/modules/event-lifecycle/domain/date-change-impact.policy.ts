import {
  addDaysToDateKey,
  type PrismDateChangeApprovedWork,
  type PrismDateChangePayment,
  type PrismDateChangePaymentState,
} from '@prism/types';

/**
 * What moving an event's date touches, as plain rules. Nothing here changes anything: money received, supplier bookings and
 * client-approved work are reported, never rewritten, and every decision about them stays with their owners.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one calendar date to another; negative when the new date is earlier. */
export function shiftBetween(currentKey: string, newKey: string): number {
  return Math.round((Date.parse(`${newKey}T00:00:00Z`) - Date.parse(`${currentKey}T00:00:00Z`)) / DAY_MS);
}

export interface MilestoneFacts {
  id: string;
  label: string;
  amount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: string;
}

export function paymentState(milestone: Pick<MilestoneFacts, 'amountPaid' | 'remainingBalance'>): PrismDateChangePaymentState {
  if (milestone.remainingBalance <= 0) return 'paid';
  return milestone.amountPaid > 0 ? 'partial' : 'open';
}

/**
 * Each milestone with what is paid, what is owed, and, only for a balance still owed and only when the date is being
 * considered, the due date moved by the same number of days. A paid milestone is never given a suggestion.
 */
export function paymentImpacts(milestones: readonly MilestoneFacts[], shiftDays: number | null): PrismDateChangePayment[] {
  return milestones.map((milestone) => {
    const state = paymentState(milestone);
    const movable = state !== 'paid' && shiftDays !== null && shiftDays !== 0;
    return {
      milestoneId: milestone.id,
      label: milestone.label,
      amount: milestone.amount,
      amountPaid: milestone.amountPaid,
      remaining: Math.max(0, milestone.remainingBalance),
      dueDate: milestone.dueDate,
      state,
      suggestedDueDate: movable ? addDaysToDateKey(milestone.dueDate, shiftDays) : null,
    };
  });
}

/** Why a supplier may not serve the new date, from what P.R.I.S.M already knows. */
export function supplierConflicts(input: { blockedOnNewDate: boolean; otherEventsOnNewDate: readonly string[] }): string[] {
  return [
    input.blockedOnNewDate ? 'Marked unavailable on that date' : '',
    ...input.otherEventsOnNewDate.map((eventName) => `Already booked for ${eventName} on that date`),
  ].filter(Boolean);
}

export interface ApprovedWorkFacts {
  conformeSigned: boolean;
  proposalApproved: boolean;
  floorPlanApproved: boolean;
  billingSent: boolean;
}

const APPROVED_WORK: ReadonlyArray<PrismDateChangeApprovedWork & { fact: keyof ApprovedWorkFacts }> = [
  {
    fact: 'conformeSigned',
    kind: 'conforme',
    label: 'Signed conforme',
    detail: 'It names the event date. A new date needs an addendum the client countersigns, in Briefing → Scope changes.',
  },
  {
    fact: 'proposalApproved',
    kind: 'proposal',
    label: 'Approved proposal',
    detail: 'The client approved it for the current date. Check its prices and suppliers still hold for the new one.',
  },
  {
    fact: 'floorPlanApproved',
    kind: 'floorplan',
    label: 'Approved floor plan',
    detail: 'The client approved this layout. Confirm the venue is the same on the new date.',
  },
  {
    fact: 'billingSent',
    kind: 'billing',
    label: 'Sent billing statement',
    detail: 'The client has its payment schedule. Moving a due date means a billing correction the client will see.',
  },
];

/** What the client already signed or approved, in the order a date change usually matters. Never changed by propagation. */
export function approvedWorkFrom(facts: ApprovedWorkFacts): PrismDateChangeApprovedWork[] {
  return APPROVED_WORK.filter((entry) => facts[entry.fact]).map(({ fact: _fact, ...item }) => item);
}
