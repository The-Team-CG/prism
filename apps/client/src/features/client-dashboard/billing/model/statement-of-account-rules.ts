import type { PrismStatementOfAccount, PrismStatementOfAccountLine } from "@prism/types";

type Format = (amount: number) => string;

export type StatementFigure = { label: string; value: string; detail?: string };

/** The five numbers a client reads first, in the order the money moves. Credit and refunds appear only when there are any. */
export function statementFigures(statement: PrismStatementOfAccount, format: Format): StatementFigure[] {
  const figures: StatementFigure[] = [
    { label: "Billed", value: format(statement.billed), detail: statement.statementNumber ? `Statement ${statement.statementNumber}` : undefined },
    { label: "Received", value: format(statement.received) },
  ];
  if (statement.refunded > 0) figures.push({ label: "Paid back to you", value: format(statement.refunded) });
  if (statement.creditHeld > 0) figures.push({ label: "Credit held for you", value: format(statement.creditHeld), detail: "Received, not yet applied to a payment" });
  figures.push({ label: statement.balance > 0 ? "Balance due" : "Balance", value: format(statement.balance) });
  return figures;
}

/**
 * What the billing page does not already say. It already shows what was billed, paid and still owed, so on the page the
 * statement adds only money paid back and credit being held. The printed statement keeps every figure.
 */
export function statementHighlights(statement: PrismStatementOfAccount, format: Format): StatementFigure[] {
  return statementFigures(statement, format).filter((figure) => figure.label === "Paid back to you" || figure.label === "Credit held for you");
}

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

export function statementFileName(statement: Pick<PrismStatementOfAccount, "statementNumber" | "eventId">): string {
  return `statement-of-account-${statement.statementNumber ?? statement.eventId}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
}

/** Every line of the printed statement, in reading order. Plain text: the PDF writer decides how it is laid out. */
export function statementPdfLines(statement: PrismStatementOfAccount, format: Format): string[] {
  const lines = [
    "P.R.I.S.M STATEMENT OF ACCOUNT",
    `Event: ${statement.eventName}`,
    `Billing statement: ${statement.statementNumber ?? "None yet"}`,
    `Prepared: ${statement.generatedAt.slice(0, 10)}`,
    "",
    ...statementFigures(statement, format).map((figure) => `${figure.label}: ${figure.value}`),
    "",
    "Payment schedule",
    ...statement.milestones.map((milestone) => `${milestone.label} (due ${milestone.dueDate}): ${format(milestone.paid)} of ${format(milestone.amount)}, ${format(milestone.remaining)} remaining`),
    "",
    "Payments and refunds",
    ...(statement.lines.length === 0 ? ["Nothing received yet."] : statement.lines.map((line) => `${line.date}  ${statementLineLabel(line)}  ${statementLineAmount(line, format)}${line.method ? `  ${line.method}` : ""}${line.reference ? `  Ref ${line.reference}` : ""}`)),
    "",
    "A reversed payment is listed for completeness and is not counted in the totals above.",
  ];
  return lines;
}
