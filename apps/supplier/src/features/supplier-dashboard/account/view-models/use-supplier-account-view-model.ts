"use client";

import { useMemo } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { accountChange, type AccountActions } from "@prism/ui/account-page";
import { signOutSupplier } from "../../workspace/use-cases/supplier-workspace-actions";
import { manilaDateKey } from "@prism/ui/format-date";
import type { AccountContact, AccountIdentity, AccountLink, AccountPrivacySummary, AccountSecuritySummary } from "@prism/ui/account-page";
import { supplierOwnPrivacyRequestsResource } from "../../privacy/data/supplier-privacy-repository";
import { supplierSectionHref } from "../../workspace/model/supplier-workspace-types";
import { supplierAccountRepository, supplierCurrentUserResource, supplierOwnSessionsResource, supplierOwnSignInsResource } from "../data/supplier-account-repository";

const OPEN = new Set(["submitted", "approved"]);

/** Suppliers talk to PMCM's team about their bookings in Messages rather than to one named person. */
const PMCM_CONTACT: AccountContact = { name: "PMCM team", detail: "Ask about any booking, quote or payment", href: supplierSectionHref("messages") };

const SUPPLIER_LINKS: AccountLink[] = [
  { title: "Your supplier record", description: "Services, tier and contact details PMCM keeps for your business", href: supplierSectionHref("profile") },
];

/** The supplier's account page: who they are, how they sign in, who to message at PMCM and their privacy at a glance. */
export function useSupplierAccountViewModel() {
  const me = useResource(supplierCurrentUserResource, undefined);
  const signIns = useResource(supplierOwnSignInsResource, undefined);
  const sessions = useResource(supplierOwnSessionsResource, undefined);
  const invalidate = useInvalidate();
  const actions: AccountActions = {
    saveName: accountChange(supplierAccountRepository.updateName, () => invalidate(supplierCurrentUserResource)),
    // Every session ends with the old password, so the person signs in again with the new one.
    changePassword: accountChange(supplierAccountRepository.changePassword, async () => { await signOutSupplier(); window.location.assign("/sign-in"); }),
    signOutSession: accountChange(supplierAccountRepository.signOutSession, () => invalidate(supplierOwnSessionsResource)),
    signOutOtherSessions: accountChange(supplierAccountRepository.signOutOtherSessions, () => invalidate(supplierOwnSessionsResource)),
  };
  const privacy = useResource(supplierOwnPrivacyRequestsResource, undefined);
  const user = me.status === "ready" ? me.data : null;

  const privacySummary = useMemo((): AccountPrivacySummary | null => {
    if (!user) return null;
    const open = (privacy.status === "ready" ? privacy.data : []).filter((request) => OPEN.has(request.status));
    return { openCount: open.length, nextDueAt: open.map((request) => request.dueAt).sort()[0] ?? null, notice: user.privacyNotice, href: supplierSectionHref("privacy") };
  }, [privacy, user]);

  return {
    actions,
    signIns: signIns.status === "ready" ? signIns.data : null,
    sessions: sessions.status === "ready" ? sessions.data : null,
    loading: me.status === "pending",
    error: me.status === "error" ? me.error.message || "We could not load your account." : null,
    identity: user ? ({ name: user.name, email: user.email, organization: user.organization, roleLabel: "Supplier" } satisfies AccountIdentity) : null,
    security: user ? ({ signedInAt: user.lastSignInAt, twoFactorEnabled: user.twoFactorEnabled, twoFactorRequired: false } satisfies AccountSecuritySummary) : null,
    contact: PMCM_CONTACT,
    privacy: privacySummary,
    links: SUPPLIER_LINKS,
    today: manilaDateKey(),
  };
}
