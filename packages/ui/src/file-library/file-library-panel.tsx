"use client";

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import type { PrismLifecycleStage } from "@prism/types";
import { CountdownPill, EventCard, EventCardHeader, StageTrack, type CardLink } from "../event-cards";
import { cn } from "../utils";
import type { FileDropTarget } from "./file-library";

/**
 * The two levels of Files on every portal, drawn after PMCM's: a start page of event cards that say how many of each
 * event's requested files are in, and, for the chosen event, one Library panel with what needs doing above the
 * filters and table.
 */

/** Requested files for one event: all of them, those still open, and those of the open ones past their due date. */
export type FileTally = { total: number; open: number; overdue?: number };

function tallyText(tally: FileTally) {
  if (tally.open === 0) return { text: "All in", tone: "text-success" };
  const overdue = tally.overdue ?? 0;
  return {
    text: `${tally.open} still needed${overdue > 0 ? ` · ${overdue} overdue` : ""}`,
    tone: overdue > 0 ? "text-danger" : "text-attention",
  };
}

function FileTallyBar({ tally }: { tally: FileTally }) {
  const done = tally.total - tally.open;
  const state = tallyText(tally);
  return (
    <div>
      <div role="img" aria-label={`${done} of ${tally.total} requested files in`} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${Math.round((done / tally.total) * 100)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{done} of {tally.total} files in</span>
        <span className={cn("font-semibold", state.tone)}>{state.text}</span>
      </div>
    </div>
  );
}

/**
 * One event on a Files start page: the same cover, date and countdown as on Events, its stage when the portal knows
 * it, and how many of the files asked for are in. The title opens that event's library.
 */
export function FileEventCard({ cover, date, title, titleLabel, href, link, onNavigate, details, todayKey, finished = false, stage, tally, note }: {
  cover: ReactNode;
  date: string | null;
  title: string;
  /** What the title link says to a screen reader: "Open files: Gala Night". */
  titleLabel?: string;
  href: string;
  link?: CardLink;
  onNavigate?: () => void;
  details?: ReactNode;
  todayKey: string;
  /** The event is over: no countdown, and the card is drawn quieter. */
  finished?: boolean;
  stage?: PrismLifecycleStage;
  /** Requested files; null while they load, so nothing is claimed. */
  tally?: FileTally | null;
  /** One more line, such as how many files are new since the last visit. */
  note?: ReactNode;
}) {
  return (
    <EventCard cover={cover}>
      <EventCardHeader
        onCover
        date={date ?? ""}
        title={title}
        titleLabel={titleLabel}
        href={href}
        link={link}
        onNavigate={onNavigate}
        details={details}
        aside={date && !finished ? <CountdownPill date={date} todayKey={todayKey} /> : null}
        muted={finished}
      />
      {stage ? <StageTrack stage={stage} /> : null}
      {tally ? (tally.total > 0 ? <FileTallyBar tally={tally} /> : <p className="text-[11px] text-muted-foreground">No files requested</p>) : null}
      {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
    </EventCard>
  );
}

/**
 * What needs doing before the files: PMCM's files waiting for review, or what PMCM still needs from a client or
 * supplier. An orange box with a count, a hint or bulk action on the right, and one row per item.
 */
export function FileActionList({ id, title, count, aside, lead, children }: {
  id?: string;
  title: string;
  count: number;
  aside?: ReactNode;
  /** Before the title, such as a select-all box. */
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="rounded-lg border border-attention/30 bg-attention-soft/40 px-4 pt-3 pb-1">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {lead}
          <h3 className="text-sm font-semibold text-foreground">{title} <span className="text-attention tabular-nums">{count}</span></h3>
        </div>
        {aside}
      </header>
      <ul className="mt-1 divide-y divide-border">{children}</ul>
    </section>
  );
}

/**
 * One event's files: a heading with the way to add a file, what needs doing, then the filters and table edge to edge.
 * Files dropped anywhere on the table go to `drop`.
 */
export function FileLibraryPanel({ title = "Library", description, actions, children, files, footer, drop, dropLabel = "Drop to add to this event" }: {
  title?: string;
  description: ReactNode;
  actions?: ReactNode;
  /** Notices and what needs doing, above the files. */
  children?: ReactNode;
  /** The filter bar and the table or its empty line. */
  files: ReactNode;
  footer?: ReactNode;
  drop?: FileDropTarget;
  dropLabel?: string;
}) {
  return (
    <section aria-label="Event file library" className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
      <div
        {...drop?.props}
        role="region"
        aria-label="Files"
        className={cn(
          "relative -mx-4 border-t border-border sm:-mx-5",
          footer ? "border-b" : "-mb-4 overflow-hidden rounded-b-xl sm:-mb-5",
          drop?.over && "outline-2 -outline-offset-2 outline-primary/50",
        )}
      >
        {files}
        {drop?.over ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80 text-sm font-medium text-primary">
            <span className="inline-flex items-center gap-2"><Upload className="size-4" /> {dropLabel}</span>
          </div>
        ) : null}
      </div>
      {footer}
    </section>
  );
}

const EVENT_PARAM = "event";

/**
 * Which event a Files page has open, kept in the address (`?event=<id>`) so Back returns to the cards and a link can
 * open one event's files. Null shows the cards.
 */
export function useFileEventChoice() {
  const [eventId, setEventId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setEventId(new URLSearchParams(window.location.search).get(EVENT_PARAM));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const choose = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(EVENT_PARAM, id);
    else url.searchParams.delete(EVENT_PARAM);
    window.history.pushState(null, "", url);
    setEventId(id);
    window.scrollTo({ top: 0 });
  }, []);
  return { eventId, choose };
}

/** The address of one event's files on the current Files page, for a card's link. */
export function fileEventHref(eventId: string) {
  return `?${EVENT_PARAM}=${encodeURIComponent(eventId)}`;
}

/** Above an opened event's library: the way back to every event's card, and which event this is. */
export function FileEventHeading({ title, meta, onBack, backLabel = "All events" }: { title: string; meta?: ReactNode; onBack: () => void; backLabel?: string }) {
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onBack();
  };
  return (
    <div className="grid gap-1">
      <a href="?" onClick={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />{backLabel}
      </a>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
    </div>
  );
}
