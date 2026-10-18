/**
 * Deterministic inquiry triage rules for PMCM organization matching, merge eligibility,
 * and high-fit notifications. These are pure functions; AI scoring (FR-AI-01) stays gated.
 */

export type InquiryMatchBasis = 'organization' | 'email';

const HIGH_FIT_CLIENT_TYPES = new Set(['corporate', 'government']);

/** Organization key: company name folded to lowercase letters and digits. Null when no company is recorded. */
export function inquiryOrganizationKey(companyName: string | null | undefined): string | null {
  const key = (companyName ?? '').trim().toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, '');
  return key || null;
}

/** Deterministic high-fit: corporate or government client, a named organization, and an event still ahead. */
export function isDeterministicHighFitInquiry(
  input: { clientType: string; companyName?: string | null; eventDate: Date },
  now: Date,
): boolean {
  return (
    HIGH_FIT_CLIENT_TYPES.has(input.clientType.trim().toLowerCase()) &&
    Boolean(input.companyName?.trim()) &&
    input.eventDate.getTime() > now.getTime()
  );
}

/** Two inquiries may be merged only when they share an organization or a contact email. */
export function resolveInquiryMergeBasis(
  source: { organizationKey: string | null; normalizedEmail: string },
  target: { organizationKey: string | null; normalizedEmail: string },
): InquiryMatchBasis | null {
  if (source.organizationKey && source.organizationKey === target.organizationKey) return 'organization';
  if (source.normalizedEmail && source.normalizedEmail === target.normalizedEmail) return 'email';
  return null;
}
