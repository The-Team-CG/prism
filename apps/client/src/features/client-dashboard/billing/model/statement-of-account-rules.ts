import type { PrismStatementOfAccountLine } from "@prism/types";

type Format = (amount: number) => string;

/** The sign a line takes in the running picture: money in for you is shown as a payment, money back to you as a refund. */
export function statementLineLabel(line: PrismStatementOfAccountLine): string {
  if (line.kind === "refund") return "Refund";
  if (line.kind === "credit") return "Credit";
  return line.reversed ? "Payment (reversed)" : "Payment";
}

/** How a line's amount reads: a reversed payment is struck out of the totals, so it is shown without a plus sign. */
export function statementLineAmount(line: PrismStatementOfAccountLine, format: Format): string {
  if (line.reversed) return format(line.amount);
  return line.kind === "refund" ? `−${format(line.amount)}` : `+${format(line.amount)}`;
}
