import { z } from "zod";

/** PMCM has one set of payment details for the whole company, so the list stays short enough to read at a glance. */
export const PAYMENT_METHODS_MAX = 8;

/** A payment QR is a small screenshot or export from a bank or wallet app. */
export const PAYMENT_QR_MAX_BYTES = 1024 * 1024;
export const PAYMENT_QR_CONTENT_TYPES = ["image/png", "image/jpeg"] as const;
export type PaymentQrContentType = (typeof PAYMENT_QR_CONTENT_TYPES)[number];

const methodId = z.string().uuid();
const label = z.string().trim().min(1, "Name this payment method").max(60);
const accountName = z.string().trim().min(1, "Enter the account name").max(120);
const instructions = z.string().trim().max(500).default("");

/** A bank account or an e-wallet (GCash, Maya). Either can carry a QR the client scans from their own banking app. */
const accountMethod = {
  id: methodId,
  label,
  accountName,
  accountNumber: z.string().trim().min(1, "Enter the account number").max(60),
  instructions,
  qrImageId: z.string().trim().min(1).max(100).nullable().default(null),
  enabled: z.boolean(),
};

export const paymentMethodSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bank"), ...accountMethod }).strict(),
  z.object({ kind: z.literal("ewallet"), ...accountMethod }).strict(),
  /** A cheque has a payee, no account number and no QR. */
  z.object({ kind: z.literal("cheque"), id: methodId, label, accountName: accountName, instructions, enabled: z.boolean() }).strict(),
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentMethodKind = PaymentMethod["kind"];

/**
 * Replaces the whole list. `expectedRevision` is the revision the editor loaded (0 before anything was saved), so two
 * people editing at once cannot silently overwrite each other.
 */
export const savePaymentDetailsSchema = z.object({
  expectedRevision: z.number().int().min(0),
  methods: z.array(paymentMethodSchema).max(PAYMENT_METHODS_MAX),
}).strict().superRefine((value, context) => {
  if (new Set(value.methods.map((method) => method.id)).size !== value.methods.length) {
    context.addIssue({ code: "custom", path: ["methods"], message: "Each payment method needs its own id" });
  }
  if (value.methods.length > 0 && !value.methods.some((method) => method.enabled)) {
    context.addIssue({ code: "custom", path: ["methods"], message: "Keep at least one payment method turned on" });
  }
});
export type SavePaymentDetailsInput = z.infer<typeof savePaymentDetailsSchema>;

/** The label and printed details of one method, in the `{ label, details }` shape billing documents already use. */
export function paymentMethodLine(method: PaymentMethod): { label: string; details: string } {
  const lines = method.kind === "cheque"
    ? [`Payable to ${method.accountName}`]
    : [method.accountName, method.accountNumber];
  if (method.instructions) lines.push(method.instructions);
  return { label: method.label, details: lines.join("\n") };
}
