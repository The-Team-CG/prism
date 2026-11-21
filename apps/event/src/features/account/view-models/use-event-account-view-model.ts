"use client";

import { useInvalidate, useResource } from "@prism/portal-query";
import { accountChange, type AccountActions } from "@prism/ui/account-page";
import { twoStepStart } from "@prism/ui/account-two-step";
import { clearEventSession } from "@/app/lib/session";
import { manilaDateKey } from "@prism/ui/format-date";
import type { AccountIdentity, AccountLink, AccountSecuritySummary } from "@prism/ui/account-page";
import { roleLabel } from "@/features/pmcm-kit/model/display-labels";
import { eventAccountRepository, eventCurrentUserResource, eventOwnSessionsResource, eventOwnSignInsResource } from "../data/event-account-repository";
import { portalHref } from "@prism/ui/portal-path";

/** PMCM admins keep the workspace's own settings, apart from their personal account. */
const ADMIN_LINKS: AccountLink[] = [
  { title: "Settings", description: "Event rules, templates, people and access, and integrations", href: "/dashboard/settings" },
];

/**
 * A PMCM staff member's or coordinator's account page: who they are and how they sign in. Two-step sign-in is
 * required for PMCM admins, so it reads as required rather than as a choice.
 */
export function useEventAccountViewModel() {
  const me = useResource(eventCurrentUserResource, undefined);
  const signIns = useResource(eventOwnSignInsResource, undefined);
  const sessions = useResource(eventOwnSessionsResource, undefined);
  const invalidate = useInvalidate();
  const actions: AccountActions = {
    saveName: accountChange(eventAccountRepository.updateName, () => invalidate(eventCurrentUserResource)),
    // Every session ends with the old password, so the person signs in again with the new one.
    changePassword: accountChange(eventAccountRepository.changePassword, () => { clearEventSession(); window.location.assign(portalHref("/sign-in")); }),
    changeEmail: {
      request: accountChange(eventAccountRepository.requestEmailChange, () => invalidate(eventCurrentUserResource)),
      cancel: accountChange(eventAccountRepository.cancelEmailChange, () => invalidate(eventCurrentUserResource)),
    },
    twoStep: {
      start: twoStepStart(eventAccountRepository.startTwoStep),
      enable: accountChange(eventAccountRepository.enableTwoStep, () => invalidate(eventCurrentUserResource)),
      disable: accountChange(eventAccountRepository.disableTwoStep, () => invalidate(eventCurrentUserResource)),
    },
    signOutSession: accountChange(eventAccountRepository.signOutSession, () => invalidate(eventOwnSessionsResource)),
    signOutOtherSessions: accountChange(eventAccountRepository.signOutOtherSessions, () => invalidate(eventOwnSessionsResource)),
  };
  const user = me.status === "ready" ? me.data : null;
  const isAdmin = user?.role === "pmcm-admin";
  return {
    actions,
    signIns: signIns.status === "ready" ? signIns.data : null,
    sessions: sessions.status === "ready" ? sessions.data : null,
    loading: me.status === "pending",
    error: me.status === "error" ? me.error.message || "We could not load your account." : null,
    identity: user ? ({ name: user.name, email: user.email, pendingEmail: user.pendingEmail, organization: user.organization, roleLabel: roleLabel(user.role) } satisfies AccountIdentity) : null,
    security: user ? ({ signedInAt: user.lastSignInAt, twoFactorEnabled: user.twoFactorEnabled, twoFactorRequired: isAdmin } satisfies AccountSecuritySummary) : null,
    links: isAdmin ? ADMIN_LINKS : [],
    today: manilaDateKey(),
  };
}
