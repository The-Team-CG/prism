const EMAIL_TEST_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EMAIL_REDACT_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_TEST_RE = /\+?(?=(?:[\d\s().-]*\d){10,})[\d\s().-]{10,}/;
const PHONE_REDACT_RE = /\+?(?=(?:[\d\s().-]*\d){10,})[\d\s().-]{10,}/g;
const SSN_TEST_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_REDACT_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PAYMENT_CARD_TEST_RE = /\b(?:\d[ -]*?){13,19}\b/;
const PAYMENT_CARD_REDACT_RE = /\b(?:\d[ -]*?){13,19}\b/g;

/** True when any string inside the value matches a high-risk personal-data pattern. */
export function containsPii(value: unknown): boolean {
  if (typeof value === 'string') return EMAIL_TEST_RE.test(value) || PHONE_TEST_RE.test(value) || SSN_TEST_RE.test(value) || PAYMENT_CARD_TEST_RE.test(value);
  if (Array.isArray(value)) return value.some(containsPii);
  if (value && typeof value === 'object') return Object.values(value).some(containsPii);
  return false;
}

/** Replaces high-risk personal-data patterns inside one string. */
export function redactString(value: string): string {
  return value
    .replace(EMAIL_REDACT_RE, '[email redacted]')
    .replace(PHONE_REDACT_RE, '[phone redacted]')
    .replace(SSN_REDACT_RE, '[identifier redacted]')
    .replace(PAYMENT_CARD_REDACT_RE, '[payment data redacted]');
}
