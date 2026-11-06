"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cx } from "@/features/pmcm-kit";
import { Input } from "@/app/components/ui/input";
import type { useAccountAdminViewModel } from "../view-models/use-account-admin-view-model";

type AccountAdminVm = ReturnType<typeof useAccountAdminViewModel>;

/** Team's "Invite staff" entry point: a disclosure button that opens the PMCM staff invitation form. */
export function StaffInvitePanel({ vm }: { vm: AccountAdminVm }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <UserPlus className="size-4" /> Invite staff
        </Button>
      </div>
      {open ? <StaffInviteForm vm={vm} onCancel={() => setOpen(false)} /> : null}
    </div>
  );
}

export function StaffInviteForm({ vm, onCancel }: { vm: AccountAdminVm; onCancel: () => void }) {
  return (
    <form onSubmit={vm.submitInvite} className="grid gap-3 rounded-lg border border-border bg-surface-raised p-4 sm:grid-cols-2 lg:grid-cols-4">
      <p className="text-sm font-semibold text-foreground sm:col-span-2 lg:col-span-4">Invite a PMCM staff member</p>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Name
        <Input required value={vm.draft.name} onChange={(event) => vm.updateDraft("name", event.target.value)} placeholder="Full name" className="h-10 bg-white" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Email
        <Input required type="email" value={vm.draft.email} onChange={(event) => vm.updateDraft("email", event.target.value)} placeholder="name@pmcm.ph" className="h-10 bg-white" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Organization
        <Input value={vm.draft.organization} onChange={(event) => vm.updateDraft("organization", event.target.value)} placeholder="PMCM" className="h-10 bg-white" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Role
        <select
          value={vm.draft.role}
          onChange={(event) => vm.updateDraft("role", event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
        >
          <option value="coordinator">Coordinator</option>
          <option value="pmcm-admin">PMCM administrator</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={vm.inviteBusy}>
          {vm.inviteBusy ? "Sending…" : "Send invitation"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {vm.inviteFeedback ? (
          <p role="status" className={cx("text-xs", vm.inviteFeedback.tone === "success" ? "text-success" : "text-danger")}>{vm.inviteFeedback.text}</p>
        ) : null}
      </div>
    </form>
  );
}
