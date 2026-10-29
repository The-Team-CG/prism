"use client";

import Link from "next/link";
import { FileSignature, Send } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { CLIENT_CONFORME_REVIEW_HREF } from "../../workspace/model/client-dashboard-navigation";
import { selectClientAccountActions } from "../../workspace/model/client-dashboard-selectors";
import { money } from "../../workspace/model/client-dashboard-view-rules";
import { dashboardHref, useClientWorkspace } from "../../workspace/shared";
import { ClientFigureStrip } from "../../shared/client-list-ui";
import { clientHomeFigures } from "../model/client-home-summary";
import { ClientHomeActionCenter, ClientHomeEvents } from "./sections/client-home-sections";

export function ClientHomeView() {
  const { state, actionCenter, actionCenterLoadFailed, events, setSelectedEventId, runClientAction } = useClientWorkspace();
  if (!state) return null;

  const todayKey = manilaDateKey();
  const actions = selectClientAccountActions(actionCenter);
  const figures = clientHomeFigures({
    actions,
    events,
    payments: state.paymentMilestones,
    todayKey,
    hrefFor: (route, eventId) => dashboardHref(route, eventId),
    formatMoney: (amount) => money.format(amount),
    formatDate: (value) => formatPortalDate(value),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm"><Link href={CLIENT_CONFORME_REVIEW_HREF}><FileSignature className="size-4" /> Review conforme</Link></Button>
        <Button asChild size="sm"><Link href="/dashboard/request"><Send className="size-4" /> New event request</Link></Button>
      </div>
      <ClientFigureStrip label="Your account at a glance" figures={figures} />
      {actionCenterLoadFailed && actionCenter ? <p role="alert" className="rounded-lg bg-attention-soft px-4 py-3 text-sm text-attention">The latest refresh failed. These are your last loaded updates. Refresh the page to try again.</p> : null}
      {actionCenter || actionCenterLoadFailed ? (
        <ClientHomeActionCenter actionCenter={actionCenter} clientActions={actions} runClientAction={runClientAction} loadFailed={actionCenterLoadFailed} todayKey={todayKey} />
      ) : null}
      <ClientHomeEvents
        events={events}
        viewAllHref="/dashboard/events"
        requestHref="/dashboard/request"
        eventHref={(eventId) => dashboardHref("overview", eventId)}
        onOpen={setSelectedEventId}
        todayKey={todayKey}
      />
    </div>
  );
}
