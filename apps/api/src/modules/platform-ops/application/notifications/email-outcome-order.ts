import type { Prisma } from '@prisma/client';

/**
 * How far an email has got. A later report never overwrites a further-along one: a late `delivered`
 * cannot undo `bounced`, and a spam complaint outranks everything before it. Equal ranks keep the first.
 */
const RANK = {
  sent: 1, delivery_delayed: 2, delivered: 3, opened: 4, clicked: 5,
  suppressed: 6, failed: 6, bounced: 6, complained: 7,
} as const;

export type EmailOutcome = keyof typeof RANK;

export const isEmailOutcome = (value: string): value is EmailOutcome => Object.prototype.hasOwnProperty.call(RANK, value);

/** Outcomes strictly before `outcome`: the only values it may replace. */
export function emailOutcomesBefore(outcome: EmailOutcome): EmailOutcome[] {
  return (Object.keys(RANK) as EmailOutcome[]).filter((candidate) => RANK[candidate] < RANK[outcome]);
}

/** The delivery rows an email outcome may advance: those with no outcome yet or an earlier one. */
export function emailOutcomeAdvanceWhere(receipt: string, outcome: EmailOutcome): Prisma.OpsNotificationDeliveryWhereInput {
  return { providerReceipt: receipt, notification: { channel: 'email' }, OR: [{ providerOutcome: null }, { providerOutcome: { in: emailOutcomesBefore(outcome) } }] };
}
