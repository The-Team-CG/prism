"use client";

import Link from "next/link";
import { FileSignature, Send } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PrismPageColumn, PrismStatRow } from "@prism/ui/page-blocks";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { CLIENT_CONFORME_REVIEW_HREF } from "../../workspace/model/client-dashboard-navigation";
import { selectClientAccountActions } from "../../workspace/model/client-dashboard-selectors";
import { money } from "../../workspace/model/client-dashboard-view-rules";
import { dashboardHref, useClientWorkspace } from "../../workspace/shared";
import { clientHomeFigures, clientHomeLead, clientHomeSummaryLine, timeOfDayGreeting } from "../model/client-home-summary";
import { ClientHomeActionCenter, ClientHomeEvents, ClientHomeEventTeam, ClientHomeHero } from "./sections/client-home-sections";

export function ClientHomeView() {
  const { state, session, actionCenter, actionCenterLoadFailed, events, setSelectedEventId, runClientAction } = useClientWorkspace();
  if (!state) return null;

  const todayKey = manilaDateKey();
  const actions = selectClientAccountActions(actionCenter);
  const own = actions.filter((action) => (action.nextActor ?? "you") === "you");
  const lead = clientHomeLead(events, own, todayKey);
  const eventHref = (eventId: string) => dashboardHref("overview", eventId);
  // The hero and list already say what needs the client and when the next event is, so only the
  // figures that appear nowhere else are shown.
  const repeatedElsewhere = new Set(["Needs you", "Next event"]);
  const figures = clientHomeFigures({
    actions,
    events,
    payments: state.paymentMilestones,
    todayKey,
    hrefFor: (route, eventId) => dashboardHref(route, eventId),
    formatMoney: (amount) => money.format(amount),
    formatDate: (value) => formatPortalDate(value),
  }).filter((figure) => !repeatedElsewhere.has(figure.label));
  const support = pmcmSupportContactFromEnvironment();
  const firstName = session.name.trim().split(/\s+/)[0];

  return (
    <PrismPageColumn>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-base text-muted-foreground">
          <span className="font-semibold text-foreground">{timeOfDayGreeting(new Date().getHours())}{firstName ? `, ${firstName}` : ""}.</span>
          {actionCenter ? ` ${clientHomeSummaryLine(own)}` : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href={CLIENT_CONFORME_REVIEW_HREF}><FileSignature className="size-4" /> Review conforme</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/request"><Send className="size-4" /> New event request</Link></Button>
        </div>
      </div>
      {lead ? <ClientHomeHero lead={lead} eventHref={eventHref} onOpen={setSelectedEventId} runClientAction={runClientAction} /> : null}
      {actionCenterLoadFailed && actionCenter ? <p role="alert" className="rounded-lg bg-attention-soft px-4 py-3 text-sm text-attention">The latest refresh failed. These are your last loaded updates. Refresh the page to try again.</p> : null}
      {actionCenter || actionCenterLoadFailed ? (
        <ClientHomeActionCenter actionCenter={actionCenter} clientActions={actions} runClientAction={runClientAction} loadFailed={actionCenterLoadFailed} todayKey={todayKey} leadActionId={lead?.action?.id} />
      ) : null}
      <PrismStatRow
        label="Your account at a glance"
        stats={figures.map((figure) => ({ ...figure, tone: figure.tone === "urgent" || figure.tone === "attention" ? figure.tone : undefined }))}
      />
      <ClientHomeEvents
        events={events}
        viewAllHref="/dashboard/events"
        requestHref="/dashboard/request"
        eventHref={eventHref}
        onOpen={setSelectedEventId}
        todayKey={todayKey}
        leadEventId={lead?.event.id}
      />
      <ClientHomeEventTeam messagesHref="/dashboard/messages" email={support.email} phone={support.phone} />
    </PrismPageColumn>
  );
}
