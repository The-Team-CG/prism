import type { NotificationAction } from '@prism/types';
import type { PrismPortalUrls } from '@prism/kernel/shared';

/** Use configured portal origins only. A query survives the signed-out dashboard redirect; a fragment does not. */
export function conversationNoticeUrl(action: NotificationAction | undefined, portals: PrismPortalUrls | undefined): string | undefined {
  if (action?.kind !== 'conversation' || !action.portal || !portals) return undefined;
  if (action.portal === 'coordinator') return `${portals.event}/dashboard?view=messages&conversation=${encodeURIComponent(action.threadId)}`;
  return `${portals[action.portal]}/dashboard/messages?conversation=${encodeURIComponent(action.threadId)}`;
}
