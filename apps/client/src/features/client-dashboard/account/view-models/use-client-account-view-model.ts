"use client";

import { useMemo } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { accountChange, type AccountActions } from "@prism/ui/account-page";
import { twoStepStart } from "@prism/ui/account-two-step";
import { signOutClientSession } from "../../workspace/use-cases/client-dashboard-actions";
import { manilaDateKey } from "@prism/ui/format-date";
import type { AccountContact, AccountIdentity, AccountPrivacySummary, AccountSecuritySummary } from "@prism/ui/account-page";
import { useClientWorkspace } from "../../workspace/shared";
import { clientOwnPrivacyRequestsResource } from "../../privacy/data/client-privacy-repository";
import { clientAccountRepository, clientCurrentUserResource, clientOwnSessionsResource, clientOwnSignInsResource } from "../data/client-account-repository";
import { clientPmcmContact } from "../model/client-pmcm-contact";

const OPEN = new Set(["submitted", "approved"]);

/** The client's account page: who they are, how they sign in, their PMCM contact and their privacy at a glance. */
export function useClientAccountViewModel() {
  const me = useResource(clientCurrentUserResource, undefined);
  const signIns = useResource(clientOwnSignInsResource, undefined);
  const sessions = useResource(clientOwnSessionsResource, undefined);
  const invalidate = useInvalidate();
  const actions: AccountActions = {
    saveName: accountChange(clientAccountRepository.updateName, () => invalidate(clientCurrentUserResource)),
    // Every session ends with the old password, so the person signs in again with the new one.
    changePassword: accountChange(clientAccountRepository.changePassword, async () => { await signOutClientSession(); window.location.assign("/sign-in"); }),
    twoStep: {
      start: twoStepStart(clientAccountRepository.startTwoStep),
      enable: accountChange(clientAccountRepository.enableTwoStep, () => invalidate(clientCurrentUserResource)),
      disable: accountChange(clientAccountRepository.disableTwoStep, () => invalidate(clientCurrentUserResource)),
    },
    signOutSession: accountChange(clientAccountRepository.signOutSession, () => invalidate(clientOwnSessionsResource)),
    signOutOtherSessions: accountChange(clientAccountRepository.signOutOtherSessions, () => invalidate(clientOwnSessionsResource)),
  };
  const privacy = useResource(clientOwnPrivacyRequestsResource, undefined);
  const { state, events } = useClientWorkspace();
  const today = manilaDateKey();
  const user = me.status === "ready" ? me.data : null;

  const contact = useMemo((): AccountContact | null => {
    const found = clientPmcmContact(state?.pmcmContacts ?? [], events, today);
    return found ? { ...found, href: "/dashboard/messages" } : null;
  }, [events, state, today]);

  const privacySummary = useMemo((): AccountPrivacySummary | null => {
    if (!user) return null;
    const open = (privacy.status === "ready" ? privacy.data : []).filter((request) => OPEN.has(request.status));
    const nextDueAt = open.map((request) => request.dueAt).sort()[0] ?? null;
    return { openCount: open.length, nextDueAt, notice: user.privacyNotice, href: "/dashboard/privacy" };
  }, [privacy, user]);

  return {
    actions,
    signIns: signIns.status === "ready" ? signIns.data : null,
    sessions: sessions.status === "ready" ? sessions.data : null,
    loading: me.status === "pending",
    error: me.status === "error" ? me.error.message || "We could not load your account." : null,
    identity: user ? ({ name: user.name, email: user.email, organization: user.organization, roleLabel: "Client" } satisfies AccountIdentity) : null,
    security: user ? ({ signedInAt: user.lastSignInAt, twoFactorEnabled: user.twoFactorEnabled, twoFactorRequired: false } satisfies AccountSecuritySummary) : null,
    contact,
    privacy: privacySummary,
    today,
  };
}
