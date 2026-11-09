"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { PrismUser } from "@prism/types";
import { invitationOutcomeCopy, type InvitationOutcomeFeedback } from "@/features/pmcm-kit/model/invitation-outcome-copy";
import { createAuditTrailRepository } from "../data/audit-trail-repository";
import { inviteStaffAccount, type StaffInvitationDraft } from "../use-cases/invite-staff-account";

type AccountFeedback = InvitationOutcomeFeedback & { userId: string };

/** An account action that waits for the admin's confirmation before it runs. */
export type PendingAccountAction = { kind: "unlock" | "reset-two-factor"; user: PrismUser };

export function pendingActionCopy({ kind, user }: PendingAccountAction) {
  return kind === "unlock"
    ? { title: `Unlock ${user.name}'s account?`, description: "This clears the lock and the failed-attempt count.", confirmLabel: "Unlock account" }
    : { title: `Reset two-factor for ${user.name}?`, description: "Their open sessions end and they set up two-factor again at next sign-in.", confirmLabel: "Reset two-factor" };
}

const emptyDraft: StaffInvitationDraft = { name: "", email: "", organization: "", role: "coordinator" };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useAccountAdminViewModel({ onAccountsChanged }: { onAccountsChanged: () => Promise<void> }) {
  const repository = useMemo(() => createAuditTrailRepository(), []);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<AccountFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAccountAction | null>(null);
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

  const requestUnlock = (user: PrismUser) => setPendingAction({ kind: "unlock", user });
  const requestResetTwoFactor = (user: PrismUser) => setPendingAction({ kind: "reset-two-factor", user });
  const cancelPendingAction = () => setPendingAction(null);

  /** Runs the action the admin just confirmed, and closes the confirmation before it starts. */
  const confirmPendingAction = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    const { user } = action;
    return runAccountAction(user, async () => {
      if (action.kind === "unlock") {
        await repository.unlockUser(user.id);
        return { tone: "success", text: "Account unlocked." };
      }
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
    pendingAction,
    requestUnlock,
    requestResetTwoFactor,
    cancelPendingAction,
    confirmPendingAction,
    resendInvitation,
    draft,
    updateDraft,
    inviteBusy,
    inviteFeedback,
    submitInvite,
  };
}
