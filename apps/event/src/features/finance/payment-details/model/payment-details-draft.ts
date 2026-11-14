import { savePaymentDetailsSchema, type PaymentMethod, type PaymentMethodKind } from "@prism/types";

export const KIND_LABEL: Record<PaymentMethodKind, string> = { bank: "Bank account", ewallet: "GCash or Maya", cheque: "Cheque" };
const DEFAULT_LABEL: Record<PaymentMethodKind, string> = { bank: "Bank transfer", ewallet: "GCash", cheque: "Cheque" };

/** An empty method of one kind, ready to fill in. It starts on so a new account is not forgotten when saving. */
export function newMethod(kind: PaymentMethodKind, id: string = crypto.randomUUID()): PaymentMethod {
  const base = { id, label: DEFAULT_LABEL[kind], accountName: "", instructions: "", enabled: true };
  return kind === "cheque" ? { kind, ...base } : { kind, ...base, accountNumber: "", qrImageId: null };
}

export type MethodField = "label" | "accountName" | "accountNumber" | "instructions" | "qrImageId" | "enabled";

/** Sets one field. A cheque has no account number or QR, so those are ignored for it. */
export function setField(methods: PaymentMethod[], id: string, field: MethodField, value: string | boolean | null): PaymentMethod[] {
  return methods.map((method) => {
    if (method.id !== id) return method;
    if (method.kind === "cheque" && (field === "accountNumber" || field === "qrImageId")) return method;
    return { ...method, [field]: value } as PaymentMethod;
  });
}

export function removeMethod(methods: PaymentMethod[], id: string): PaymentMethod[] {
  return methods.filter((method) => method.id !== id);
}

/** Moves a method one place up (-1) or down (1); at the end of the list it stays put. */
export function moveMethod(methods: PaymentMethod[], id: string, direction: -1 | 1): PaymentMethod[] {
  const from = methods.findIndex((method) => method.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= methods.length) return methods;
  const next = [...methods];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export const isDirty = (saved: PaymentMethod[], draft: PaymentMethod[]): boolean => JSON.stringify(saved) !== JSON.stringify(draft);

/** What is missing on one method, in the words shown next to it. */
export function methodProblems(method: PaymentMethod): string[] {
  const problems: string[] = [];
  if (!method.label.trim()) problems.push("Name this payment method.");
  if (!method.accountName.trim()) problems.push(method.kind === "cheque" ? "Enter who the cheque is payable to." : "Enter the account name.");
  if (method.kind !== "cheque" && !method.accountNumber.trim()) problems.push("Enter the account number.");
  return problems;
}

/** The first reason the whole list cannot be saved, or null. */
export function saveProblem(methods: PaymentMethod[]): string | null {
  const incomplete = methods.find((method) => methodProblems(method).length > 0);
  if (incomplete) return `${incomplete.label.trim() || KIND_LABEL[incomplete.kind]}: ${methodProblems(incomplete)[0]}`;
  const parsed = savePaymentDetailsSchema.safeParse({ expectedRevision: 0, methods });
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "These payment details cannot be saved.");
}

/** Names of methods that already existed and whose account number is changing: clients see the new number at once. */
export function changedAccountNumbers(saved: PaymentMethod[], draft: PaymentMethod[]): string[] {
  const before = new Map(saved.map((method) => [method.id, method]));
  return draft.flatMap((method) => {
    const old = before.get(method.id);
    const changed = old && "accountNumber" in old && "accountNumber" in method && old.accountNumber.trim() !== method.accountNumber.trim();
    return changed ? [method.label] : [];
  });
}

/** The last four digits or letters of an account number, for a collapsed row, without spaces or dashes. */
export function lastDigits(method: PaymentMethod): string {
  return "accountNumber" in method ? method.accountNumber.replace(/[^0-9a-z]/gi, "").slice(-4) : "";
}
