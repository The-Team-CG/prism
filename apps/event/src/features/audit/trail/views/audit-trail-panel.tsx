"use client";

import type { PrismAuthenticatedSession, PrismEvent, PrismUser } from "@prism/types";
import { useAccountAdminViewModel } from "../view-models/use-account-admin-view-model";
import { useAuditTrailViewModel } from "../view-models/use-audit-trail-view-model";
import { AccountAdminPanel } from "./account-admin-panel";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  AuditTrailOverview,
  LoginHistoryPanel,
  PrivacyConsoleLinkPanel,
  SecurityAlertsPanel,
} from "./audit-trail-sections";

export function AuditTrailPanel({
  events: eventsProp,
  users: usersProp,
  session: sessionProp,
}: {
  events?: PrismEvent[];
  users?: PrismUser[];
  session?: PrismAuthenticatedSession;
} = {}) {
  const vm = useAuditTrailViewModel();
  const accounts = useAccountAdminViewModel({ onAccountsChanged: vm.refreshUsers });
  const session = sessionProp ?? vm.session;
  const events = eventsProp ?? vm.events;
  const users = usersProp ?? vm.users;

  if (!session) {
    return <LoadingState label="Loading audit trail..." className="p-6" />;
  }

  return (
    <div className="space-y-5">
      <AuditTrailOverview vm={vm} events={events} users={users} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <PrivacyConsoleLinkPanel />
          <LoginHistoryPanel loginHistory={vm.loginHistory} />
        </div>
        <SecurityAlertsPanel alerts={vm.alerts} />
      </div>
      <AccountAdminPanel users={users} viewerRole={session.role} vm={accounts} />
    </div>
  );
}
