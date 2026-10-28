import { portalUrlFor, type PrismPortalApp } from "@prism/types";
import type { PrismSupportContact } from "@prism/ui/account-help";

/**
 * The four portal origins as literal reads, so Next inlines each NEXT_PUBLIC_*_PORTAL_URL into client bundles.
 * A bare `process.env` object is empty in the browser. A missing value is a configuration error, never a default.
 */
export function portalUrlsFromEnvironment(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_CLIENT_PORTAL_URL: process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL,
    NEXT_PUBLIC_SUPPLIER_PORTAL_URL: process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL,
    NEXT_PUBLIC_GUEST_PORTAL_URL: process.env.NEXT_PUBLIC_GUEST_PORTAL_URL,
    NEXT_PUBLIC_EVENT_PORTAL_URL: process.env.NEXT_PUBLIC_EVENT_PORTAL_URL,
  };
}

/**
 * The PMCM account-help channel for this deployment, read literally so Next inlines it. Unlike portal URLs it is
 * optional: blank means "no channel configured", and help copy falls back to plain instructions instead of a guess.
 */
export function pmcmSupportContactFromEnvironment(): PrismSupportContact {
  const email = process.env.NEXT_PUBLIC_PMCM_SUPPORT_EMAIL?.trim();
  const phone = process.env.NEXT_PUBLIC_PMCM_SUPPORT_PHONE?.trim();
  return { ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
}

export interface WrongPortalLink {
  label: string;
  href: string;
}

const PORTAL_LABELS: Record<PrismPortalApp, string> = {
  client: "Client portal",
  supplier: "Supplier portal",
  guest: "Guest portal",
  event: "Event portal",
};

const PORTAL_ORDER: PrismPortalApp[] = ["client", "supplier", "guest", "event"];

/** Sign-in links to every other portal. A missing portal URL throws (see portalUrlFor). */
export function wrongPortalLinks(current: PrismPortalApp, env: Record<string, string | undefined>): WrongPortalLink[] {
  return PORTAL_ORDER.filter((portal) => portal !== current).map((portal) => ({
    label: PORTAL_LABELS[portal],
    href: `${portalUrlFor(portal, env).replace(/\/+$/, "")}/sign-in`,
  }));
}
