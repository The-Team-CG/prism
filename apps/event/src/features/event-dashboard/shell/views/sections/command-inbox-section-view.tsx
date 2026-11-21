"use client";

import { useMemo } from "react";
import { useResource } from "@prism/portal-query";
import { addDays } from "@prism/ui/calendar-views";
import { manilaDateKey } from "@prism/ui/format-date";
import { EventCommandInbox } from "@/features/command-inbox/list";
import { INBOX_TODAY_LOOKAHEAD_DAYS, selectInboxToday } from "@/features/command-inbox/list/model/inbox-today";
import { InboxTodayHero } from "@/features/command-inbox/list/views/inbox-today-hero";
import { inboxLiveEvent } from "@/features/command-inbox/list/data/command-inbox-repository";
import { pmcmCalendar } from "@/features/pmcm-overview";
import { useEventDashboardScopedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardCommandInboxSectionView() {
  const {
    commandInbox,
    refreshCommandInbox,
    changeCommandInboxPage,
    commandInboxLoadFailed,
  } = useEventDashboardScopedRouteViewModel();
  const todayKey = manilaDateKey();
  const calendar = useResource(pmcmCalendar, { from: todayKey, to: addDays(todayKey, INBOX_TODAY_LOOKAHEAD_DAYS) });
  const today = useMemo(() => (calendar.data ? selectInboxToday(calendar.data.items, todayKey) : null), [calendar.data, todayKey]);
  const live = useResource(inboxLiveEvent, today?.lead?.live ? today.lead.eventId : null).data;
  return (
    <div className="space-y-5">
      {today ? <InboxTodayHero today={today} todayKey={todayKey} live={live} /> : null}
      <EventCommandInbox
        inbox={commandInbox}
        onRefresh={() => refreshCommandInbox().catch(() => undefined)}
        onPageChange={(page) => changeCommandInboxPage(page).catch(() => undefined)}
        loadFailed={commandInboxLoadFailed}
      />
    </div>
  );
}
