"use client";

import { useMemo } from "react";
import { useResource } from "@prism/portal-query";
import { manilaDateKey } from "@prism/ui/format-date";
import type { AccountContact, AccountIdentity, AccountPrivacySummary, AccountSecuritySummary } from "@prism/ui/account-page";
import { useClientWorkspace } from "../../workspace/shared";
import { clientOwnPrivacyRequestsResource } from "../../privacy/data/client-privacy-repository";
import { clientCurrentUserResource } from "../data/client-account-repository";
import { clientPmcmContact } from "../model/client-pmcm-contact";

const OPEN = new Set(["submitted", "approved"]);

/** The client's account page: who they are, how they sign in, their PMCM contact and their privacy at a glance. */
export function useClientAccountViewModel() {
  const me = useResource(clientCurrentUserResource, undefined);
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
    loading: me.status === "pending",
    error: me.status === "error" ? me.error.message || "We could not load your account." : null,
    identity: user ? ({ name: user.name, email: user.email, organization: user.organization, roleLabel: "Client" } satisfies AccountIdentity) : null,
    security: user ? ({ signedInAt: user.lastSignInAt, twoFactorEnabled: user.twoFactorEnabled, twoFactorRequired: false } satisfies AccountSecuritySummary) : null,
    contact,
    privacy: privacySummary,
    today,
  };
}
