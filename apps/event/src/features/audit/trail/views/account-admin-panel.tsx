"use client";

import type { PrismUser, PrismUserRole } from "@prism/types";
import { UserRound } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Panel, cx, label } from "@/features/pmcm-kit";
import { adminAccountActionsFor, canManageAccounts, isAccountLocked } from "../model/audit-trail-rules";
import type { useAccountAdminViewModel } from "../view-models/use-account-admin-view-model";

type AccountAdminVm = ReturnType<typeof useAccountAdminViewModel>;

export function AccountAdminPanel({
  users,
  viewerRole,
  vm,
}: {
  users: PrismUser[];
  viewerRole: PrismUserRole;
  vm: AccountAdminVm;
}) {
  if (!canManageAccounts(viewerRole)) return null;
  const now = new Date();

  return (
    <Panel title="Accounts and staff invitations" icon={UserRound}>
      <div className="space-y-5">
        <div className="space-y-3">
          {users.length === 0 ? <p className="text-sm text-muted-foreground">No accounts loaded.</p> : null}
          {users.map((user) => (
            <AccountRow
              key={user.id}
              user={user}
              locked={isAccountLocked(user, now)}
              actions={adminAccountActionsFor(user, viewerRole, now)}
              vm={vm}
            />
          ))}
        </div>
        <StaffInviteForm vm={vm} />
      </div>
    </Panel>
  );
}

function AccountRow({
  user,
  locked,
  actions,
  vm,
}: {
  user: PrismUser;
  locked: boolean;
  actions: ReturnType<typeof adminAccountActionsFor>;
  vm: AccountAdminVm;
}) {
  const feedback = vm.accountFeedback?.userId === user.id ? vm.accountFeedback : null;
  const busy = vm.busyUserId !== null;
  const hasAction = actions.unlockAccount || actions.resetTwoFactor || actions.resendInvitation;

  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black">{user.name}</p>
          <p className="text-xs text-muted-foreground">
            {user.email} · {label(user.role)} · {label(user.approvalStatus)}{locked ? " · Locked" : ""}
          </p>
        </div>
        {hasAction ? (
          <div className="flex flex-wrap gap-2">
            {actions.unlockAccount ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => vm.unlockAccount(user)}>
                Unlock account
              </Button>
            ) : null}
            {actions.resetTwoFactor ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => vm.resetTwoFactor(user)}>
                Reset two-factor
              </Button>
            ) : null}
            {actions.resendInvitation ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => vm.resendInvitation(user)}>
                Resend invitation
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {feedback ? (
        <p className={cx("mt-2 text-xs", feedback.tone === "success" ? "text-emerald-700" : "text-rose-700")}>{feedback.text}</p>
      ) : null}
    </div>
  );
}

function StaffInviteForm({ vm }: { vm: AccountAdminVm }) {
  return (
    <form onSubmit={vm.submitInvite} className="grid gap-3 rounded-md border border-border bg-muted p-4 md:grid-cols-2">
      <p className="text-sm font-black md:col-span-2">Invite staff</p>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Name
        <Input value={vm.draft.name} onChange={(event) => vm.updateDraft("name", event.target.value)} className="mt-2 h-10 bg-white" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Email
        <Input value={vm.draft.email} onChange={(event) => vm.updateDraft("email", event.target.value)} className="mt-2 h-10 bg-white" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Organization
        <Input value={vm.draft.organization} onChange={(event) => vm.updateDraft("organization", event.target.value)} className="mt-2 h-10 bg-white" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Role
        <select
          value={vm.draft.role}
          onChange={(event) => vm.updateDraft("role", event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm normal-case text-foreground"
        >
          <option value="pmcm-admin">PMCM admin</option>
          <option value="coordinator">Coordinator</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
        <Button type="submit" disabled={vm.inviteBusy} className="h-10 rounded-md font-black">
          Send invitation
        </Button>
        {vm.inviteFeedback ? (
          <p className={cx("text-xs", vm.inviteFeedback.tone === "success" ? "text-emerald-700" : "text-rose-700")}>{vm.inviteFeedback.text}</p>
        ) : null}
      </div>
    </form>
  );
}
