import Link from "next/link";
import { PrismHero } from "@prism/ui/page-blocks";
import { daysUntil, formatPortalDate } from "@prism/ui/format-date";
import type { InboxLiveCounts, InboxToday } from "../model/inbox-today";

type InboxLead = NonNullable<InboxToday["lead"]>;
type HeroCopy = { label: string; title: string; meta: string; figure?: { value: string; label: string }; note: string; action: string; href: string };

const eventHref = (eventId: string, view: "overview" | "live-ops") => `/dashboard/events/${encodeURIComponent(eventId)}/${view}`;

function shortDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const joinMeta = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

function guestsInLabel(live: InboxLiveCounts) {
  if (live.guestsExpected) return `of ${live.guestsExpected} guests in`;
  return live.guestsIn === 1 ? "guest in" : "guests in";
}

function liveNote(live: InboxLiveCounts | undefined) {
  if (!live) return "Check-ins, issues and the run sheet are on the live desk.";
  if (!live.openIssues) return "No open issues. The run sheet is on the live desk.";
  return `${live.openIssues} ${live.openIssues === 1 ? "issue" : "issues"} still open on the live desk.`;
}

/** The event is on today: guests in against expected, and open issues, with the live desk one click away. */
function liveCopy(lead: InboxLead, todayKey: string, live: InboxLiveCounts | undefined): HeroCopy {
  return {
    label: `Today · ${shortDay(todayKey)}`,
    title: `${lead.eventName} is on today`,
    meta: joinMeta([lead.detail, lead.startTime ? `starts ${lead.startTime}` : undefined]),
    figure: live ? { value: String(live.guestsIn), label: guestsInLabel(live) } : undefined,
    note: liveNote(live),
    action: "Open live desk",
    href: eventHref(lead.eventId, "live-ops"),
  };
}

/** The next event day: how long until it, and its overview for what is still waiting. */
function upcomingCopy(lead: InboxLead, todayKey: string): HeroCopy {
  const days = daysUntil(lead.date, todayKey) ?? 0;
  return {
    label: "Your next event",
    title: lead.eventName,
    meta: joinMeta([formatPortalDate(lead.date), lead.detail, lead.startTime ? `starts ${lead.startTime}` : undefined]),
    figure: { value: String(days), label: days === 1 ? "day to go" : "days to go" },
    note: "Its overview says what is still waiting before the day.",
    action: "Open event",
    href: eventHref(lead.eventId, "overview"),
  };
}

/**
 * The Inbox's lead: the event on today (with the live desk one click away), or the next event and how long until it,
 * then the few events after it this week. Nothing renders while there is no event in the lookahead.
 */
export function InboxTodayHero({ today, todayKey, live }: { today: InboxToday; todayKey: string; live?: InboxLiveCounts }) {
  const { lead, week } = today;
  if (!lead) return null;
  const copy = lead.live ? liveCopy(lead, todayKey, live) : upcomingCopy(lead, todayKey);
  return (
    <div className="space-y-3">
      <PrismHero
        label={copy.label}
        title={<Link href={eventHref(lead.eventId, "overview")} className="hover:underline">{copy.title}</Link>}
        meta={copy.meta}
        figure={copy.figure}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-foreground/70">{copy.note}</p>
          <Link
            href={copy.href}
            className="rounded-md bg-ink-foreground px-3 py-2 text-sm font-semibold text-ink outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.action}
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
