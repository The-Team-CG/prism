"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acknowledgeNotificationReceiptSchema, NOTIFICATION_INBOX_MAX_LIMIT, NOTIFICATION_INBOX_PAGE_SIZE, parseContract,
  type AcknowledgeNotificationReceiptInput, type PrismNotificationInbox,
} from "@prism/types";
import { manilaDateKey } from "../format-date";
import { useVisibleRefresh } from "../chat/use-visible-refresh";
import { filterNotices, groupNoticesByDay, needsAcknowledgment, noticesNeedingYou, type Notice, type NoticeFilter } from "./notice-model";

/** The account's inbox operations; each portal passes its authenticated API client group. */
export interface NoticeActions {
  inbox(limit?: number): Promise<PrismNotificationInbox>;
  markNoticeRead(id: string, input: AcknowledgeNotificationReceiptInput): Promise<unknown>;
  acknowledgeReceipt(id: string, input: AcknowledgeNotificationReceiptInput): Promise<unknown>;
  markAllNoticesRead(): Promise<unknown>;
}

/** A notice sent on two channels is one row with a copy per channel; each copy is validated against its own version. */
function eachCopy(notice: Notice, send: (id: string, input: AcknowledgeNotificationReceiptInput) => Promise<unknown>) {
  return Promise.all((notice.deliveries ?? [notice]).map((copy) => send(copy.id, parseContract(acknowledgeNotificationReceiptSchema, { version: copy.version }, "Notification receipt"))));
}

function withRead(inbox: PrismNotificationInbox | null, ids: ReadonlySet<string> | "all", readAt: string): PrismNotificationInbox | null {
  if (!inbox) return inbox;
  const items = inbox.items.map((item) => (ids === "all" || ids.has(item.id) ? { ...item, readAt: item.readAt ?? readAt } : item));
  const newlyRead = inbox.items.filter((item, index) => !item.readAt && items[index].readAt).length;
  return { ...inbox, items, unread: ids === "all" ? 0 : Math.max(0, inbox.unread - newlyRead) };
}

/**
 * The notification inbox for one portal: the newest notices, what is waiting on the reader, notices grouped by day, and
 * the actions on them. `onChange` runs after anything the reader did, so a navigation badge can read again.
 */
export function useNotificationCenter(actions: NoticeActions, onChange?: () => void) {
  const [limit, setLimit] = useState(NOTIFICATION_INBOX_PAGE_SIZE);
  const [inbox, setInbox] = useState<PrismNotificationInbox | null>(null);
  const [filter, setFilter] = useState<NoticeFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setInbox(await actions.inbox(limit));
    setError(null);
  }, [actions, limit]);
  useEffect(() => {
    let active = true;
    load().catch(() => { if (active) setError("Unable to load your notifications."); });
    return () => { active = false; };
  }, [load]);
  useVisibleRefresh(load, true);

  const run = useCallback(async (task: () => Promise<unknown>, failure: string) => {
    try {
      await task();
      onChange?.();
    } catch {
      await load().catch(() => undefined);
      setError(failure);
    }
  }, [load, onChange]);

  const read = useCallback(async (notice: Notice) => {
    if (notice.readAt) return;
    setInbox((current) => withRead(current, new Set([notice.id]), new Date().toISOString()));
    await run(() => eachCopy(notice, actions.markNoticeRead), "Unable to record the notification read state.");
  }, [actions, run]);

  const readAll = useCallback(async () => {
    setInbox((current) => withRead(current, "all", new Date().toISOString()));
    await run(() => actions.markAllNoticesRead().then(load), "Unable to mark your notifications read.");
  }, [actions, load, run]);

  const acknowledge = useCallback(async (notice: Notice) => {
    if (busy) return;
    setBusy(notice.id);
    setError(null);
    await run(() => eachCopy(notice, actions.acknowledgeReceipt).then(load), "Unable to acknowledge this notification. Refresh and review the latest notice.");
    setBusy(null);
  }, [actions, busy, load, run]);

  const retry = useCallback(() => {
    setError(null);
    load().catch(() => setError("Unable to load your notifications."));
  }, [load]);

  const items = useMemo(() => inbox?.items ?? [], [inbox]);
  const todayKey = manilaDateKey();
  // What is waiting on the reader is listed above the days, so the days hold everything else.
  const days = useMemo(() => groupNoticesByDay(filterNotices(items.filter((notice) => !needsAcknowledgment(notice)), filter), todayKey), [items, filter, todayKey]);
  const needsYou = useMemo(() => noticesNeedingYou(items), [items]);
  return {
    loading: inbox === null && !error, error, filter, setFilter, days, needsYou, busy,
    total: items.length, unread: inbox?.unread ?? 0,
    // The API reads at most the newest NOTIFICATION_INBOX_MAX_LIMIT notices; past that there is nothing more to ask for.
    hasMore: (inbox?.hasMore ?? false) && limit < NOTIFICATION_INBOX_MAX_LIMIT,
    atLimit: (inbox?.hasMore ?? false) && limit >= NOTIFICATION_INBOX_MAX_LIMIT,
    read, readAll, acknowledge, retry,
    showMore: () => setLimit((current) => Math.min(current + NOTIFICATION_INBOX_PAGE_SIZE, NOTIFICATION_INBOX_MAX_LIMIT)),
  };
}

export type NotificationCenterState = ReturnType<typeof useNotificationCenter>;
