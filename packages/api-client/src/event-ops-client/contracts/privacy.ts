import type { DownloadOwnPrivacyDataInput, PrismNotificationPreferences, PrismOwnPrivacyDownload, PrismOwnPrivacyRequest, PrismViberLink, SubmitOwnPrivacyRequestInput, UpdateNotificationPreferencesInput } from "@prism/types";

export interface EventOpsNotificationPreferencesContract {
  /** FR-25: the signed-in account's own channels; email always stays on. */
  notificationPreferences: {
    /** The account's newest notices, `limit` of them, with the unread total for the whole inbox. */
    inbox(limit?: number): Promise<import('@prism/types').PrismNotificationInbox>;
    /** The unread total alone, cheap enough to poll for a navigation badge. */
    unreadCount(): Promise<{ unread: number }>;
    markAllNoticesRead(): Promise<{ marked: number }>;
    markNoticeRead(id: string, input: import('@prism/types').AcknowledgeNotificationReceiptInput): Promise<{ id: string; readAt: string }>;
    acknowledgeReceipt(id: string, input: import('@prism/types').AcknowledgeNotificationReceiptInput): Promise<{ id: string; acknowledged: true }>;
    mine(): Promise<PrismNotificationPreferences>;
    setViberEnabled(input: UpdateNotificationPreferencesInput): Promise<PrismNotificationPreferences>;
    /** A one-time code and the deep link that opens the P.R.I.S.M Viber bot with it. */
    startViberLink(): Promise<PrismViberLink>;
    unlinkViber(): Promise<PrismNotificationPreferences>;
  };
}

export interface EventOpsPrivacyContract {
  privacy: {
    /** Files a privacy request for the signed-in client or supplier. The subject comes from the session, not the body. */
    submitOwnRequest(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest>;
    /** The signed-in client's or supplier's own requests, newest first. */
    listOwnRequests(): Promise<PrismOwnPrivacyRequest[]>;
    /** Withdraws one of their own requests while PMCM has not reviewed it. */
    cancelOwnRequest(requestId: string): Promise<PrismOwnPrivacyRequest>;
    /** Downloads their own data straight away, confirmed with their password. */
    downloadOwnData(input: DownloadOwnPrivacyDataInput): Promise<PrismOwnPrivacyDownload>;
  };
}
