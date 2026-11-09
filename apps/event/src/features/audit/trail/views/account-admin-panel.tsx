"use client";

import { useMemo, useState } from "react";
import type { PrismUser, PrismUserRole } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { Search, UserRound } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Input } from "@prism/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { Panel, SegmentedControl, cx, roleLabel } from "@/features/pmcm-kit";
import { adminAccountActionsFor, canManageAccounts, isAccountLocked } from "../model/audit-trail-rules";
import { pendingActionCopy, type useAccountAdminViewModel } from "../view-models/use-account-admin-view-model";
import { usePagedItems } from "../view-models/use-paged-items";
import { ListPager } from "./list-pager";

type AccountAdminVm = ReturnType<typeof useAccountAdminViewModel>;

const ROLE_FILTERS: ReadonlyArray<{ value: "all" | PrismUserRole; label: string }> = [
  { value: "all", label: "All" },
  { value: "pmcm-admin", label: "PMCM administrators" },
  { value: "coordinator", label: "Coordinators" },
  { value: "client", label: "Clients" },
  { value: "supplier", label: "Suppliers" },
];

const ACCOUNT_PAGE_SIZE = 8;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

export function AccountAdminPanel({
  users,
  viewerRole,
  vm,
}: {
  users: PrismUser[];
  viewerRole: PrismUserRole;
  vm: AccountAdminVm;
}) {
  const [role, setRole] = useState<"all" | PrismUserRole>("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      users.filter(
        (user) => (role === "all" || user.role === role) && `${user.name} ${user.email} ${user.organization}`.toLowerCase().includes(needle),
      ),
    [users, role, needle],
  );
  const paged = usePagedItems(visible, ACCOUNT_PAGE_SIZE);
  if (!canManageAccounts(viewerRole)) return null;
  const now = new Date();
  const roleOptions = ROLE_FILTERS.map((filter) => ({
    value: filter.value,
    label: filter.label,
    count: filter.value === "all" ? users.length : users.filter((user) => user.role === filter.value).length,
  }));

  return (
    <Panel title="Accounts" icon={UserRound}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Filter accounts by role" options={roleOptions} value={role} onChange={(value) => setRole(value as "all" | PrismUserRole)} />
          <label className="relative min-w-52 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or organization" aria-label="Search accounts" className="h-9 bg-white pl-9" />
          </label>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {visible.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">{users.length === 0 ? "No accounts loaded." : "No account matches these filters."}</p>
          ) : (
            <Table>
              <caption className="sr-only">Accounts with their role, sign-in status and available actions</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Account</TableHead>
                  <TableHead scope="col">Role</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  {/* Fixed width keeps the role and status columns still when a row has more or fewer actions. */}
                  <TableHead scope="col" className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.pageItems.map((user) => (
                  <AccountRow key={user.id} user={user} locked={isAccountLocked(user, now)} actions={adminAccountActionsFor(user, viewerRole, now)} vm={vm} />
                ))}
              </TableBody>
            </Table>
          )}
          <ListPager
            label="Account pages"
            rangeLabel={`${paged.rangeLabel} accounts`}
            page={paged.page}
            pageCount={paged.pageCount}
            onPrevious={paged.previous}
            onNext={paged.next}
          />
        </div>
      </div>
      <AccountActionConfirmation vm={vm} />
    </Panel>
  );
}

/** Asks the admin to confirm an unlock or two-factor reset; neither runs until they choose to. */
function AccountActionConfirmation({ vm }: { vm: AccountAdminVm }) {
  const copy = vm.pendingAction ? pendingActionCopy(vm.pendingAction) : null;
  return (
    <Dialog open={copy !== null} onOpenChange={(open) => { if (!open) vm.cancelPendingAction(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={vm.cancelPendingAction}>Cancel</Button>
          <Button type="button" onClick={vm.confirmPendingAction}>{copy?.confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function accountState(user: PrismUser, locked: boolean): { text: string; tone: string } {
  if (locked) return { text: user.permanentLockout ? "Locked until unlocked" : "Locked", tone: "text-danger font-medium" };
  if (user.approvalStatus === "pending") return { text: "Invitation pending", tone: "text-attention font-medium" };
  if (user.approvalStatus !== "approved") return { text: roleLabel(user.approvalStatus), tone: "text-muted-foreground" };
  return { text: user.lastLoginAt ? `Last sign-in ${formatPortalDate(user.lastLoginAt)}` : "Never signed in", tone: "text-muted-foreground" };
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
  const state = accountState(user, locked);

  return (
    <TableRow>
      <TableCell className="min-w-0 whitespace-normal">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            {feedback ? <p className={cx("mt-1 text-xs", feedback.tone === "success" ? "text-success" : "text-danger")}>{feedback.text}</p> : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-normal">
        {roleLabel(user.role)}
        {user.organization && user.organization !== user.name ? <span className="block truncate text-xs">{user.organization}</span> : null}
      </TableCell>
      <TableCell className={cx("text-xs", state.tone)}>{state.text}</TableCell>
      <TableCell className="w-56 text-right">
        <AccountRowActions user={user} actions={actions} vm={vm} />
      </TableCell>
    </TableRow>
  );
}

function AccountRowActions({
  user,
  actions,
  vm,
}: {
  user: PrismUser;
  actions: ReturnType<typeof adminAccountActionsFor>;
  vm: AccountAdminVm;
}) {
  const busy = vm.busyUserId !== null;
  if (!(actions.unlockAccount || actions.resetTwoFactor || actions.resendInvitation)) return null;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {actions.unlockAccount ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => vm.requestUnlock(user)}>
          Unlock
        </Button>
      ) : null}
      {actions.resetTwoFactor ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => vm.requestResetTwoFactor(user)}>
          Reset two-factor
        </Button>
      ) : null}
      {actions.resendInvitation ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => vm.resendInvitation(user)}>
          Resend invite
        </Button>
      ) : null}
    </div>
  );
}
