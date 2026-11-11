"use client";
import { formatPortalDateTime } from '@prism/ui/format-date';
import { portalHref } from '@prism/ui/portal-path';
import { PrismSection } from '@prism/ui/page-blocks';
import { useNotificationInbox } from '../view-models/use-notification-inbox';
import { clientNoticeLink } from '../model/notice-link';

export function NotificationInbox() {
  const vm = useNotificationInbox();
  return <PrismSection id="notification-inbox" title="Your notifications" description="Acknowledge receipt here. Decisions and schedule confirmations still require their own action in the event workspace.">
    {vm.error ? <p role="alert" className="mb-3 text-sm text-destructive">{vm.error}</p> : null}
    {vm.loading ? <p role="status" className="text-sm text-muted-foreground">Loading notifications…</p> : null}
    {!vm.loading && !vm.error && !vm.rows.length ? <p className="text-sm text-muted-foreground">No notifications yet.</p> : null}
    <ul className="divide-y divide-border">{vm.rows.map((notice) => {
      const link = clientNoticeLink(notice.action);
      return <li key={notice.id} className="py-3">
        <details onToggle={(event) => { if (event.currentTarget.open) void vm.read(notice); }}>
          <summary className="cursor-pointer text-sm font-semibold">{notice.message.slice(0, 100)}{notice.message.length > 100 ? '…' : ''}</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{notice.message}</p>
          {notice.readAt ? <p className="mt-1 text-xs text-muted-foreground">Read</p> : null}
          {link ? <a className="mt-2 inline-block text-sm font-semibold text-primary" href={portalHref(link.href)}>{link.label}</a> : null}
          {notice.acknowledgmentDueAt ? <p className="mt-1 text-sm">Acknowledgment due {formatPortalDateTime(notice.acknowledgmentDueAt)}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{formatPortalDateTime(notice.createdAt)} · {notice.channel}</p>
          {notice.acknowledgedAt ? <p className="mt-2 text-sm">Receipt acknowledged</p> : <button type="button" className="mt-2 text-sm font-semibold text-primary" disabled={vm.busy !== null} onClick={() => void vm.acknowledge(notice)}>{vm.busy === notice.id ? 'Saving…' : 'Acknowledge receipt'}</button>}
        </details>
      </li>;
    })}</ul>
  </PrismSection>;
}
