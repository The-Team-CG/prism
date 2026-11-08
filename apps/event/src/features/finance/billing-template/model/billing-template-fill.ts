import type { PrismBillingStatement } from "@prism/types";

const peso = (amount: number) => `PHP ${Math.round(amount).toLocaleString("en-PH")}`;

/** FR-67: the placeholders PMCM can put in its own Word billing statement template. */
export function billingTemplateFields(statement: PrismBillingStatement): Record<string, string> {
  return {
    statementNumber: statement.number,
    clientName: statement.clientName,
    clientContact: statement.clientContact,
    eventName: statement.eventName,
    eventDate: statement.eventDate?.slice(0, 10) ?? "",
    totalAmount: peso(statement.totalAmount),
    lineItems: statement.lineItems.map((line) => `${line.label}: ${peso(line.amount)}`).join("\n"),
    paymentSchedule: statement.paymentSchedule.map((item) => `${item.label} (${item.percentage}%): ${peso(item.amount)}${item.dueDate ? `, due ${item.dueDate.slice(0, 10)}` : ""}`).join("\n"),
    paymentMethods: statement.paymentMethods.map((method) => `${method.label}: ${method.details}`).join("\n"),
  };
}

/** Fills {{field}} placeholders from the issued statement and lists any placeholder it does not know, for PMCM to fix. */
export function fillBillingTemplate(template: string, statement: PrismBillingStatement): { text: string; unknown: string[] } {
  const fields = billingTemplateFields(statement);
  const unknown = new Set<string>();
  const text = template.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (match, name: string) => {
    if (name in fields) return fields[name]!;
    unknown.add(name);
    return match;
  });
  return { text, unknown: [...unknown] };
}
