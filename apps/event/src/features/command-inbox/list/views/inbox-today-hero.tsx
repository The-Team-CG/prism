import Link from "next/link";
import { PrismHero } from "@prism/ui/page-blocks";
import { daysUntil, formatPortalDate } from "@prism/ui/format-date";
import type { InboxToday } from "../model/inbox-today";

const eventHref = (eventId: string, view: "overview" | "live-ops") => `/dashboard/events/${encodeURIComponent(eventId)}/${view}`;

function shortDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The Inbox's lead: the event on today (with the live desk one click away), or the next event and how long until it,
 * then the few events after it this week. Nothing renders while there is no event in the lookahead.
 */
export function InboxTodayHero({ today, todayKey }: { today: InboxToday; todayKey: string }) {
  const { lead, week } = today;
  if (!lead) return null;
  const days = daysUntil(lead.date, todayKey) ?? 0;
  return (
    <div className="space-y-3">
      <PrismHero
        label={lead.live ? `Today · ${shortDay(todayKey)}` : "Your next event"}
        title={<Link href={eventHref(lead.eventId, "overview")} className="hover:underline">{lead.live ? `${lead.eventName} is on today` : lead.eventName}</Link>}
        meta={[lead.live ? undefined : formatPortalDate(lead.date), lead.detail, lead.startTime ? `starts ${lead.startTime}` : undefined].filter(Boolean).join(" · ")}
        figure={lead.live ? undefined : { value: String(days), label: days === 1 ? "day to go" : "days to go" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-foreground/70">
            {lead.live ? "Check-ins, issues and the run sheet are on the live desk." : "Its overview says what is still waiting before the day."}
          </p>
          <Link
            href={eventHref(lead.eventId, lead.live ? "live-ops" : "overview")}
            className="rounded-md bg-ink-foreground px-3 py-2 text-sm font-semibold text-ink outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {lead.live ? "Open live desk" : "Open event"}
          </Link>
        </div>
      </PrismHero>
      {week.length > 0 ? (
        <nav aria-label="Events this week" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">This week</span>
          {week.map((item) => (
            <Link
              key={item.eventId}
              href={eventHref(item.eventId, "overview")}
              className="rounded-full border border-border bg-card px-3 py-1 text-foreground transition-colors hover:bg-surface-raised"
            >
              <span className="text-muted-foreground">{shortDay(item.date)}</span> · {item.eventName}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
