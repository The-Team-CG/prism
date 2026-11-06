/** The catalog allows up to three payment milestones per billing source. */
export const MAX_PAYMENT_MILESTONES = 3;

/** House policy: the first milestone is at least this share unless a repeat-client override is recorded. */
export const MIN_DOWNPAYMENT_PERCENT = 50;

export interface MilestoneDraft {
  label: string;
  percentage: string;
}

export const DEFAULT_MILESTONES: MilestoneDraft[] = [
  { label: "Downpayment", percentage: "50" },
  { label: "Balance", percentage: "50" },
];

export interface PaymentTermsCheck {
  schedule: Array<{ label: string; percentage: number }>;
  total: number;
  /** The first milestone is under the house minimum, so PMCM must give a repeat-client reason. */
  needsOverride: boolean;
  /** Why the terms cannot be saved yet, or null when they can. */
  problem: string | null;
}

/** Reads the milestone rows as a payment schedule and says what, if anything, stops them being saved. */
export function checkPaymentTerms(rows: readonly MilestoneDraft[]): PaymentTermsCheck {
  const schedule = rows.map((row) => ({ label: row.label.trim(), percentage: row.percentage.trim() === "" ? Number.NaN : Number(row.percentage) }));
  const total = Math.round(schedule.reduce((sum, row) => sum + (Number.isFinite(row.percentage) ? row.percentage : 0), 0) * 100) / 100;
  const needsOverride = schedule.length > 0 && Number.isFinite(schedule[0].percentage) && schedule[0].percentage < MIN_DOWNPAYMENT_PERCENT;
  const problem = (() => {
    if (schedule.length === 0) return "Add at least one payment milestone.";
    if (schedule.length > MAX_PAYMENT_MILESTONES) return `Use at most ${MAX_PAYMENT_MILESTONES} milestones.`;
    if (schedule.some((row) => !row.label)) return "Name every milestone.";
    if (schedule.some((row) => !Number.isFinite(row.percentage) || row.percentage <= 0 || row.percentage > 100)) return "Each milestone needs a percentage above 0 and up to 100.";
    if (Math.abs(total - 100) > 0.001) return `Milestones total ${total}%; they must total 100%.`;
    return null;
  })();
  return { schedule, total, needsOverride, problem };
}
