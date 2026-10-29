import type { PrismSupportContact } from "@prism/ui/account-help";

/**
 * The PMCM account-help channel for this deployment, read literally so Next inlines it. Unlike portal URLs it is
 * optional: blank means "no channel configured", and help copy falls back to plain instructions instead of a guess.
 */
export function pmcmSupportContactFromEnvironment(): PrismSupportContact {
  const email = process.env.NEXT_PUBLIC_PMCM_SUPPORT_EMAIL?.trim();
  const phone = process.env.NEXT_PUBLIC_PMCM_SUPPORT_PHONE?.trim();
  return { ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
}
