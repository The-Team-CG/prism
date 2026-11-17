"use client";

import { useResource } from "@prism/portal-query";
import { manilaDateKey } from "@prism/ui/format-date";
import type { AccountIdentity, AccountLink, AccountSecuritySummary } from "@prism/ui/account-page";
import { roleLabel } from "@/features/pmcm-kit/model/display-labels";
import { eventCurrentUserResource } from "../data/event-account-repository";

/** PMCM admins keep the workspace's own settings, apart from their personal account. */
const ADMIN_LINKS: AccountLink[] = [
  { title: "Workspace settings", description: "Compliance rules, planning templates, integrations and notification defaults", href: "/dashboard/settings" },
];

/**
 * A PMCM staff member's or coordinator's account page: who they are and how they sign in. Two-step sign-in is
 * required for PMCM admins, so it reads as required rather than as a choice.
 */
export function useEventAccountViewModel() {
  const me = useResource(eventCurrentUserResource, undefined);
  const user = me.status === "ready" ? me.data : null;
  const isAdmin = user?.role === "pmcm-admin";
  return {
    loading: me.status === "pending",
    error: me.status === "error" ? me.error.message || "We could not load your account." : null,
    identity: user ? ({ name: user.name, email: user.email, organization: user.organization, roleLabel: roleLabel(user.role) } satisfies AccountIdentity) : null,
    security: user ? ({ signedInAt: user.lastSignInAt, twoFactorEnabled: user.twoFactorEnabled, twoFactorRequired: isAdmin } satisfies AccountSecuritySummary) : null,
    links: isAdmin ? ADMIN_LINKS : [],
    today: manilaDateKey(),
  };
}
