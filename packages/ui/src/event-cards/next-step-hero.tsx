"use client";

import type { ReactNode } from "react";
import { PrismHero } from "../page-blocks";
import { daysUntil, manilaCalendarKey } from "../format-date";

/** "12 / days overdue", "Today / Due today", "3 / days left": the one number a due step leads with. */
export function dueFigure(dueAt: string | null | undefined, todayKey: string): { value: string; label: string } | undefined {
  if (!dueAt) return undefined;
  const days = daysUntil(manilaCalendarKey(dueAt), todayKey);
  if (days === null) return undefined;
  if (days < 0) return { value: String(-days), label: days === -1 ? "day overdue" : "days overdue" };
  if (days === 0) return { value: "Today", label: "Due today" };
  return { value: String(days), label: days === 1 ? "day left" : "days left" };
}

/**
 * The portal home's lead, the same card for every role: "Your next step" and when it is due, the step, the event it
 * belongs to over that event's cover, one large figure (days overdue, left or to go), and a footer with what the
 * step involves beside its one action.
 */
export function NextStepHero({ when, title, event, detail, figure, cover, action }: {
  /** When the step is due, after "Your next step": "Quote due Nov 4, 2026 · overdue". */
  when?: string;
  title: ReactNode;
  /** The event the step belongs to: its name (a link when it has a page) and details such as the date. */
  event: ReactNode;
  /** What the step involves, in a sentence. */
  detail?: ReactNode;
  figure?: { value: string; label: string };
  /** The event's cover, drawn darkened behind the card. */
  cover?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <PrismHero label={when ? `Your next step · ${when}` : "Your next step"} title={title} meta={event} figure={figure} backdrop={cover}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        {detail ? <p className="min-w-0 flex-1 basis-64 text-sm text-ink-foreground/70">{detail}</p> : <span />}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </PrismHero>
  );
}
