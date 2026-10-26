"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { PrismUser } from "@prism/types";
import { invitationOutcomeCopy, type InvitationOutcomeFeedback } from "@/features/pmcm-kit/model/invitation-outcome-copy";
import { createAuditTrailRepository } from "../data/audit-trail-repository";
import { inviteStaffAccount, type StaffInvitationDraft } from "../use-cases/invite-staff-account";

type AccountFeedback = InvitationOutcomeFeedback & { userId: string };

const emptyDraft: StaffInvitationDraft = { name: "", email: "", organization: "", role: "coordinator" };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useAccountAdminViewModel({ onAccountsChanged }: { onAccountsChanged: () => Promise<void> }) {
  const repository = useMemo(() => createAuditTrailRepository(), []);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<AccountFeedback | null>(null);
  const [draft, setDraft] = useState<StaffInvitationDraft>(emptyDraft);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<InvitationOutcomeFeedback | null>(null);

  const runAccountAction = useCallback(async (user: PrismUser, action: () => Promise<InvitationOutcomeFeedback>) => {
    setBusyUserId(user.id);
    setAccountFeedback(null);
    try {
      const feedback = await action();
      setAccountFeedback({ userId: user.id, ...feedback });
      await onAccountsChanged();
    } catch (err) {
      setAccountFeedback({ userId: user.id, tone: "error", text: errorMessage(err, "Account action failed") });
    } finally {
      setBusyUserId(null);
    }
  }, [onAccountsChanged]);

  const unlockAccount = (user: PrismUser) => {
    if (!window.confirm(`Unlock ${user.name}'s account? This clears the lock and the failed-attempt count.`)) return;
    return runAccountAction(user, async () => {
      await repository.unlockUser(user.id);
      return { tone: "success", text: "Account unlocked." };
    });
  };

  const resetTwoFactor = (user: PrismUser) => {
    if (!window.confirm(`Reset two-factor for ${user.name}? Their open sessions end and they set up two-factor again at next sign-in.`)) return;
    return runAccountAction(user, async () => {
      await repository.resetUserTwoFactor(user.id);
      return { tone: "success", text: "Two-factor reset. Open sessions were ended." };
    });
  };

  const resendInvitation = (user: PrismUser) =>
    runAccountAction(user, async () => invitationOutcomeCopy(await repository.resendAccountInvitation(user.id), user.email));

  const updateDraft = (field: keyof StaffInvitationDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteBusy(true);
    setInviteFeedback(null);
    try {
      const feedback = await inviteStaffAccount(draft, repository.inviteStaff);
      setInviteFeedback(feedback);
      if (feedback.tone === "success") {
        setDraft(emptyDraft);
        await onAccountsChanged();
      }
    } catch (err) {
      setInviteFeedback({ tone: "error", text: errorMessage(err, "Invitation failed") });
    } finally {
      setInviteBusy(false);
    }
  };

  return {
    busyUserId,
    accountFeedback,
    unlockAccount,
    resetTwoFactor,
    resendInvitation,
    draft,
    updateDraft,
    inviteBusy,
    inviteFeedback,
    submitInvite,
  };
}
