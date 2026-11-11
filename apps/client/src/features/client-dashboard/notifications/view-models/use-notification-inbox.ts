"use client";
import { useEffect, useState } from 'react';
import type { PrismNotificationInboxItem } from '@prism/types';
import { notificationPreferencesRepository } from '../data/notification-preferences-repository';
import { acknowledgeNotice, markNoticeRead } from '../use-cases/acknowledge-notice';
export function useNotificationInbox() {
  const [rows, setRows] = useState<PrismNotificationInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    notificationPreferencesRepository.inbox().then((result) => { if (active) setRows(result); }).catch(() => { if (active) setError('Unable to load your notifications.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function acknowledge(notice: PrismNotificationInboxItem) {
    if (busy) return;
    setBusy(notice.id); setError(null);
    try { await acknowledgeNotice(notice); setRows(await notificationPreferencesRepository.inbox()); }
    catch { setError('Unable to acknowledge this notification. Refresh and review the latest notice.'); }
    finally { setBusy(null); }
  }
  async function read(notice: PrismNotificationInboxItem) {
    if (notice.readAt) return;
    try { const result = await markNoticeRead(notice); setRows((current) => current.map((row) => row.id === notice.id ? { ...row, readAt: result.readAt } : row)); }
    catch { setError('Unable to record the notification read state.'); }
  }
  return { rows, loading, busy, error, acknowledge, read };
}
