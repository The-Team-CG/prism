import { PAYMENT_QR_MAX_BYTES, paymentMethodSchema, type PaymentMethod, type PaymentQrContentType } from '@prism/types';

/** The last 50 changes are kept on the row; older ones are in the audit trail. */
export const PAYMENT_DETAILS_HISTORY_LIMIT = 50;

export interface PaymentDetailsHistoryEntry {
  revision: number;
  changedBy: string;
  changedAt: string;
  /** What changed, in words. Never an account number. */
  changes: string[];
}

/** The type an image's own first bytes declare, so a renamed file cannot pass as a PNG or JPEG. */
export function sniffQrImageType(bytes: Uint8Array): PaymentQrContentType | null {
  const isPng = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (isPng) return 'image/png';
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isJpeg ? 'image/jpeg' : null;
}

/** Why an upload cannot be a payment QR, or null when it can. The declared type must agree with the bytes. */
export function qrImageProblem(bytes: Uint8Array, declaredContentType: string | undefined): string | null {
  if (bytes.byteLength === 0) return 'The QR image is empty';
  if (bytes.byteLength > PAYMENT_QR_MAX_BYTES) return 'The QR image must be 1 MB or smaller';
  const actual = sniffQrImageType(bytes);
  if (!actual) return 'The QR image must be a PNG or JPEG';
  if (declaredContentType?.split(';')[0].trim().toLowerCase() !== actual) return 'The QR image type does not match its content';
  return null;
}

/** Methods stored on the row, read defensively: anything that no longer parses is dropped rather than shown. */
export function parseStoredMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = paymentMethodSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseStoredHistory(value: unknown): PaymentDetailsHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PaymentDetailsHistoryEntry => Boolean(item) && typeof item === 'object' && Array.isArray((item as PaymentDetailsHistoryEntry).changes));
}

const numberOf = (method: PaymentMethod) => ('accountNumber' in method ? method.accountNumber : '');
const qrOf = (method: PaymentMethod) => ('qrImageId' in method ? method.qrImageId : null);

/** One row per thing that can change on a method: whether it did, and how to say so. */
const FIELD_CHANGES: Array<[(before: PaymentMethod, after: PaymentMethod) => boolean, (before: PaymentMethod, after: PaymentMethod) => string]> = [
  [(b, a) => b.label !== a.label, (b, a) => `Renamed ${b.label} to ${a.label}`],
  [(b, a) => b.enabled !== a.enabled, (_b, a) => `${a.enabled ? 'Turned on' : 'Turned off'} ${a.label}`],
  [(b, a) => b.kind !== a.kind, (_b, a) => `Changed the type of ${a.label}`],
  [(b, a) => b.accountName !== a.accountName, (_b, a) => `Changed the account name of ${a.label}`],
  [(b, a) => numberOf(b) !== numberOf(a), (_b, a) => `Changed the account number of ${a.label}`],
  [(b, a) => b.instructions !== a.instructions, (_b, a) => `Changed the instructions of ${a.label}`],
  [(b, a) => qrOf(b) !== qrOf(a), (b, a) => (qrOf(a) ? `${qrOf(b) ? 'Replaced' : 'Added'} the QR of ${a.label}` : `Removed the QR of ${a.label}`)],
];

const changesTo = (before: PaymentMethod, after: PaymentMethod): string[] =>
  FIELD_CHANGES.filter(([differs]) => differs(before, after)).map(([, say]) => say(before, after));

/** A readable list of what a save changes, empty when nothing does. Account numbers are never written into it. */
export function describePaymentDetailsChange(before: PaymentMethod[], after: PaymentMethod[]): string[] {
  const previous = new Map(before.map((method) => [method.id, method]));
  const next = new Set(after.map((method) => method.id));
  const changes = [
    ...after.filter((method) => !previous.has(method.id)).map((method) => `Added ${method.label}`),
    ...before.filter((method) => !next.has(method.id)).map((method) => `Removed ${method.label}`),
    ...after.flatMap((method) => {
      const old = previous.get(method.id);
      return old ? changesTo(old, method) : [];
    }),
  ];
  const kept = after.filter((method) => previous.has(method.id)).map((method) => method.id);
  const oldOrder = before.filter((method) => next.has(method.id)).map((method) => method.id);
  if (changes.length === 0 && kept.join() !== oldOrder.join()) changes.push('Reordered the payment methods');
  return changes;
}

/** QR images the saved methods point at, so a save can check each one was really uploaded. */
export function referencedQrImageIds(methods: PaymentMethod[]): string[] {
  return [...new Set(methods.flatMap((method) => ('qrImageId' in method && method.qrImageId ? [method.qrImageId] : [])))];
}
