import { portalUrlFor, type PrismPortalApp } from "@prism/types";

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
