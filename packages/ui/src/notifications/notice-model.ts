import type { PrismNotificationInboxItem } from "@prism/types";
import { daysUntil, dueLabel, formatPortalDate, manilaCalendarKey } from "../format-date";

export type Notice = PrismNotificationInboxItem;
export type NoticeFilter = "all" | "unread";

export const isUnread = (notice: Notice) => !notice.readAt;

/** PMCM asked this reader to confirm receipt, and they have not yet. */
export const needsAcknowledgment = (notice: Notice) => Boolean(notice.acknowledgmentDueAt) && !notice.acknowledgedAt;

export type NoticeDue = { label: string; overdue: boolean };

/** When a requested acknowledgment is due, in a phrase for the row ("Overdue 2 days", "Due tomorrow"). */
export function noticeDue(notice: Notice, now: Date, todayKey: string): NoticeDue | null {
  if (!needsAcknowledgment(notice)) return null;
  const due = notice.acknowledgmentDueAt!;
  const days = daysUntil(manilaCalendarKey(due), todayKey);
  if (days === null) return null;
  if (Date.parse(due) >= now.getTime()) return { label: dueLabel(Math.max(days, 0)), overdue: false };
  return { label: days < 0 ? dueLabel(days) : "Overdue", overdue: true };
}

/** The notices still waiting on the reader, the most overdue first. */
export function noticesNeedingYou(notices: Notice[]): Notice[] {
  return notices.filter(needsAcknowledgment).sort((a, b) => a.acknowledgmentDueAt!.localeCompare(b.acknowledgmentDueAt!));
}

export function filterNotices(notices: Notice[], filter: NoticeFilter): Notice[] {
  return filter === "unread" ? notices.filter(isUnread) : notices;
}

export type NoticeDay = { key: string; label: string; notices: Notice[] };

function dayLabel(dayKey: string, todayKey: string, createdAt: string): string {
  const age = daysUntil(dayKey, todayKey);
  if (age === 0) return "Today";
  if (age === -1) return "Yesterday";
  return formatPortalDate(createdAt);
}

/** Notices in the order given, split into the Philippine calendar days they arrived on. */
export function groupNoticesByDay(notices: Notice[], todayKey: string): NoticeDay[] {
  const days: NoticeDay[] = [];
  for (const notice of notices) {
    const key = manilaCalendarKey(notice.createdAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.notices.push(notice);
    else days.push({ key, label: dayLabel(key, todayKey, notice.createdAt), notices: [notice] });
  }
  return days;
}
