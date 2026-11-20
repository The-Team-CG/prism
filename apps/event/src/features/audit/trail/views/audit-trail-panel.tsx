"use client";

import type { PrismAuthenticatedSession, PrismEvent, PrismUser } from "@prism/types";
import { useAuditTrailViewModel } from "../view-models/use-audit-trail-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";
import { AuditTrailOverview, SecurityAlertsPanel } from "./audit-trail-sections";

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
  const session = sessionProp ?? vm.session;
  const events = eventsProp ?? vm.events;
  const users = usersProp ?? vm.users;

  if (!session) {
    return <LoadingState label="Loading audit trail..." className="p-6" />;
  }

  return (
    <div className="space-y-5">
      {/* Security alerts lead only when there are any; with none, the header says so in one word. */}
      {vm.alerts.length ? <SecurityAlertsPanel alerts={vm.alerts} /> : null}
      <AuditTrailOverview vm={vm} events={events} users={users} />
    </div>
  );
}
