import type { PrismEventFinancialSummary, PrismFinancialCategoryLine } from '@prism/types';

export interface FinancialInputs {
  statement: { number: string; totalAmount: number } | null;
  estimate: { status: string; totalAmount: number; lines: Array<{ category: string; totalAmount: number }> } | null;
  /** Active (not superseded) payment milestones. */
  milestones: Array<{ amount: number; creditApplied: number; remainingBalance: number; dueDate: Date }>;
  /** Net amount applied to this event's milestones, per receipt (reversals netted out). A record with no receipt is legacy. */
  appliedByReceipt: Array<{ receiptId: string | null; amount: number }>;
  /** Status of each receipt named above. A receipt missing here is treated as not verified. */
  receiptStatus: Map<string, string>;
  /** Live money received for this event and not applied to any milestone. */
  unapplied: number;
  /** Selected and locked supplier quotes. */
  quotes: Array<{ id: string; category: string; amount: number }>;
  /** Payment schedules created for suppliers. */
  payables: Array<{ amount: number }>;
  /** Supplier payouts: a release pays money out, a reversal takes it back. */
  payouts: Array<{ quoteId: string; kind: string; amount: number }>;
  now: Date;
}

export type FinancialFigures = Omit<PrismEventFinancialSummary, 'eventId' | 'eventName' | 'generatedAt'>;

const OTHER_CATEGORY = 'Other';
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const pesos = (amount: number) => `PHP ${amount.toLocaleString('en-PH')}`;

/** What a payout does to money paid out: a release adds to it, a reversal takes it back. */
const payoutEffect = (payout: { kind: string; amount: number }) => (payout.kind === 'release' ? payout.amount : -payout.amount);

function collectionFigures(input: FinancialInputs): FinancialFigures['collections'] {
  const received = sum(input.appliedByReceipt.map((applied) => applied.amount));
  const verifiedReceived = sum(
    input.appliedByReceipt.filter((applied) => applied.receiptId !== null && input.receiptStatus.get(applied.receiptId) === 'verified').map((applied) => applied.amount),
  );
  const overdue = sum(input.milestones.filter((milestone) => milestone.dueDate.getTime() < input.now.getTime()).map((milestone) => milestone.remainingBalance));
  return {
    scheduled: sum(input.milestones.map((milestone) => milestone.amount)),
    received,
    credit: sum(input.milestones.map((milestone) => milestone.creditApplied)),
    outstanding: sum(input.milestones.map((milestone) => milestone.remainingBalance)),
    overdue,
    verifiedReceived,
    unverifiedReceived: received - verifiedReceived,
    unapplied: input.unapplied,
  };
}

/** One row per category that appears in the estimate or the committed quotes, largest committed cost first. */
function categoryLines(input: FinancialInputs): PrismFinancialCategoryLine[] {
  const categoryOfQuote = new Map(input.quotes.map((quote) => [quote.id, quote.category || OTHER_CATEGORY]));
  const rows = new Map<string, { estimatedPrice: number; committedCost: number; actualCost: number }>();
  const row = (category: string) => {
    const existing = rows.get(category) ?? { estimatedPrice: 0, committedCost: 0, actualCost: 0 };
    rows.set(category, existing);
    return existing;
  };
  for (const line of input.estimate?.lines ?? []) row(line.category || OTHER_CATEGORY).estimatedPrice += line.totalAmount;
  for (const quote of input.quotes) row(quote.category || OTHER_CATEGORY).committedCost += quote.amount;
  for (const payout of input.payouts) row(categoryOfQuote.get(payout.quoteId) ?? OTHER_CATEGORY).actualCost += payoutEffect(payout);
  return [...rows.entries()]
    .map(([category, figures]) => ({ category, ...figures, expectedMargin: figures.estimatedPrice - figures.committedCost }))
    .sort((a, b) => b.committedCost - a.committedCost || a.category.localeCompare(b.category));
}

/** The price a margin is measured against: the billed statement if there is one, otherwise the proposal estimate. */
function priceBasis(input: FinancialInputs) {
  if (input.statement) return { basis: 'statement' as const, price: input.statement.totalAmount };
  if (input.estimate) return { basis: 'estimate' as const, price: input.estimate.totalAmount };
  return { basis: null, price: null };
}

interface NoteContext {
  input: FinancialInputs;
  collections: FinancialFigures['collections'];
  costs: FinancialFigures['costs'];
  margin: FinancialFigures['margin'];
}

/** Each rule says one thing about where the figures cannot be taken at face value, or nothing. */
const NOTE_RULES: Array<(context: NoteContext) => string | null> = [
  ({ input }) => {
    if (input.statement) return null;
    return input.estimate
      ? 'No billing statement has been issued yet, so the expected margin uses the proposal estimate.'
      : 'There is no billing statement or proposal estimate yet, so there is no price to measure against.';
  },
  ({ input, collections }) => (input.statement && collections.scheduled !== input.statement.totalAmount
    ? `Payment milestones total ${pesos(collections.scheduled)} but the billing statement is ${pesos(input.statement.totalAmount)}. Check they were regenerated together.`
    : null),
  ({ collections }) => (collections.unverifiedReceived > 0
    ? `${pesos(collections.unverifiedReceived)} of the money received comes from receipts not yet verified against a bank or wallet statement.`
    : null),
  ({ collections }) => (collections.unapplied > 0 ? `${pesos(collections.unapplied)} was received for this event but is not applied to a milestone.` : null),
  ({ costs }) => (costs.committed > costs.scheduled ? `${pesos(costs.committed - costs.scheduled)} of committed supplier cost has no payment schedule yet.` : null),
  ({ costs }) => (costs.actual > costs.committed ? `${pesos(costs.actual - costs.committed)} more has been paid to suppliers than their selected quotes commit.` : null),
  ({ margin }) => (margin.expected !== null && margin.expected < 0 ? `Committed supplier cost is ${pesos(-margin.expected)} above the price.` : null),
];

function notesFor(context: NoteContext): string[] {
  return NOTE_RULES.map((rule) => rule(context)).filter((note): note is string => note !== null);
}

/**
 * Where one event stands, from the facts alone. Nothing is guessed: a figure with no source is zero or null, and `notes`
 * says so. Estimated is the proposal's client-facing price; committed is what selected supplier quotes cost; actual is
 * what has been released to suppliers, reversals netted out.
 */
export function computeEventFinancials(input: FinancialInputs): FinancialFigures {
  const collections = collectionFigures(input);
  const committed = sum(input.quotes.map((quote) => quote.amount));
  const actual = sum(input.payouts.map(payoutEffect));
  const costs = { committed, scheduled: sum(input.payables.map((payable) => payable.amount)), actual, toPay: Math.max(0, committed - actual) };
  const { basis, price } = priceBasis(input);
  const margin = { expected: price === null ? null : price - committed, basis, cashToDate: collections.received - actual };
  return {
    price: {
      estimated: input.estimate?.totalAmount ?? null,
      estimateStatus: input.estimate ? (input.estimate.status === 'approved' ? 'approved' : 'draft') : null,
      billed: input.statement?.totalAmount ?? null,
      statementNumber: input.statement?.number ?? null,
    },
    collections,
    costs,
    margin,
    categories: categoryLines(input),
    notes: notesFor({ input, collections, costs, margin }),
  };
}
