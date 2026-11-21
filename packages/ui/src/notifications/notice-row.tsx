"use client";

import type { MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import { formatPortalTime } from "../format-date";
import { Button } from "../components/ui/button";
import { portalHref } from "../portal-path";
import { cn } from "../utils";
import { noticeIcon } from "./notice-look";
import { isUnread, needsAcknowledgment, noticeDue, type Notice } from "./notice-model";

/** Where a notice sends the reader, and what the link says. Each portal decides: the same notice opens a different page for each role. */
export type NoticeLink = { href: string; label: string };

/** How long a click waits for "read" to be saved before leaving the page, so the page change does not cancel it. */
const READ_BEFORE_LEAVING_MS = 1500;

/** A plain left click on an unread notice saves it as read, then follows the link; any other click leaves the browser to it. */
function openNotice(event: MouseEvent<HTMLAnchorElement>, notice: Notice, onRead: (notice: Notice) => Promise<void>) {
  const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!isUnread(notice)) return;
  if (!plain) {
    void onRead(notice);
    return;
  }
  event.preventDefault();
  const href = event.currentTarget.href;
  const wait = new Promise((resolve) => window.setTimeout(resolve, READ_BEFORE_LEAVING_MS));
  void Promise.race([onRead(notice), wait]).finally(() => window.location.assign(href));
}

function NoticeTitle({ notice, link, onRead }: { notice: Notice; link: NoticeLink | null; onRead: (notice: Notice) => Promise<void> }) {
  // overflow-wrap: anywhere also narrows the min-content width, so a long token wraps even in a button sized to fit.
  const style = cn("block w-full whitespace-pre-wrap text-left text-sm [overflow-wrap:anywhere]", isUnread(notice) ? "font-semibold text-foreground" : "text-foreground/80");
  if (link) {
    return <a href={portalHref(link.href)} className={cn(style, "outline-none after:absolute after:inset-0")} onClick={(event) => openNotice(event, notice, onRead)}>{notice.message}</a>;
  }
  if (isUnread(notice)) {
    return <button type="button" className={cn(style, "outline-none after:absolute after:inset-0")} onClick={() => void onRead(notice)}>{notice.message}</button>;
  }
  return <p className={style}>{notice.message}</p>;
}

function DueLine({ notice, todayKey, busy, onAcknowledge }: { notice: Notice; todayKey: string; busy: boolean; onAcknowledge: (notice: Notice) => Promise<void> }) {
  const due = noticeDue(notice, new Date(), todayKey);
  if (due) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", due.overdue ? "bg-danger-soft text-danger" : "bg-attention-soft text-attention")}>{due.label}</span>
        <Button type="button" size="sm" variant="outline" className="relative z-10" disabled={busy} onClick={() => void onAcknowledge(notice)}>{busy ? "Saving…" : "Acknowledge receipt"}</Button>
      </div>
    );
  }
  return notice.acknowledgedAt ? <p className="mt-1 text-xs text-muted-foreground">Receipt acknowledged</p> : null;
}

/** One notice: what it is about, which event, when, and what it asks of the reader. The whole row opens its item. */
export function NoticeRow({ notice, link, todayKey, busy, onRead, onAcknowledge }: {
  notice: Notice;
  link: NoticeLink | null;
  todayKey: string;
  busy: boolean;
  onRead: (notice: Notice) => Promise<void>;
  onAcknowledge: (notice: Notice) => Promise<void>;
}) {
  const Icon = noticeIcon(notice.action);
  const unread = isUnread(notice);
  const urgent = needsAcknowledgment(notice) && noticeDue(notice, new Date(), todayKey)?.overdue;
  return (
    <li className={cn("relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3 hover:bg-muted/40", unread && "bg-primary-soft/30")}>
      <span aria-hidden className={cn("grid size-9 place-items-center rounded-full", urgent ? "bg-danger-soft text-danger" : unread ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}><Icon className="size-4" /></span>
      <div className="min-w-0">
        <NoticeTitle notice={notice} link={link} onRead={onRead} />
        <p className="mt-0.5 text-xs text-muted-foreground">{notice.eventName ? `${notice.eventName} · ` : ""}{formatPortalTime(notice.createdAt)}</p>
        <DueLine notice={notice} todayKey={todayKey} busy={busy} onAcknowledge={onAcknowledge} />
      </div>
      <span className="flex items-center gap-2 self-center">
        {unread ? <span role="img" aria-label="Unread" className="size-2 rounded-full bg-primary" /> : null}
        {link ? <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">{link.label}<ChevronRight aria-hidden className="size-4" /></span> : null}
      </span>
    </li>
  );
}
