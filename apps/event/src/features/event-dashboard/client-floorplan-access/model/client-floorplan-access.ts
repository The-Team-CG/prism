import type { PrismApprovedClientAccount, PrismEventClientAccess } from "@prism/types";

export function canManageClientFloorplanAccess(role: string): boolean {
  return role === "pmcm-admin" || role === "system";
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function availableClientCandidates(
  access: PrismEventClientAccess | null,
  candidates: PrismApprovedClientAccount[],
): PrismApprovedClientAccount[] {
  if (!access) return [];

  const primaryEmail = normalizedEmail(access.primaryContact.email);
  const activeIds = new Set(access.secondaryContacts.map((contact) => contact.id));
  return candidates.filter((candidate) => {
    const email = normalizedEmail(candidate.email);
    return (!primaryEmail || email !== primaryEmail) && !activeIds.has(candidate.id);
  });
}
