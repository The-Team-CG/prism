import { z } from "zod";

export const retryNotificationSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export type RetryNotificationInput = z.infer<typeof retryNotificationSchema>;
export const acknowledgeNotificationReceiptSchema = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type AcknowledgeNotificationReceiptInput = z.infer<typeof acknowledgeNotificationReceiptSchema>;
export const requestNotificationAcknowledgmentSchema = z.object({ dueAt: z.iso.datetime({ offset: true }), reason: z.string().trim().min(1).max(500) }).strict();
export type RequestNotificationAcknowledgmentInput = z.infer<typeof requestNotificationAcknowledgmentSchema>;
/** The event areas a notice can point at. Each portal maps a section to its own route, or to no link when its role has no such page. */
export const notificationEventSectionSchema = z.enum(['overview', 'briefing', 'proposal', 'floorplans', 'billing', 'files', 'changes', 'live_ops']);
export type NotificationEventSection = z.infer<typeof notificationEventSectionSchema>;
export const notificationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('supplier_schedule'), requestId: z.string().min(1).max(200), revision: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('event_section'), eventId: z.string().min(1).max(200), section: notificationEventSectionSchema }).strict(),
  /** One conversation in Messages. */
  z.object({ kind: z.literal('conversation'), eventId: z.string().min(1).max(200), threadId: z.string().min(1).max(200) }).strict(),
]);
export type NotificationAction = z.infer<typeof notificationActionSchema>;

export interface PrismNotificationInboxItem {
  id: string;
  notificationId: string;
  eventId: string | null;
  channel: string;
  message: string;
  version: string;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  acknowledgmentDueAt?: string | null;
  action?: NotificationAction;
}

export const viberSendResponseSchema = z.object({
  status: z.number().int(),
  message_token: z.string().regex(/^[0-9]+$/).optional(),
}).passthrough();
export const resendDeliveryStatusSchema = z.object({ id: z.string().min(1), last_event: z.enum(['sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked', 'failed', 'suppressed']) }).passthrough();
export const viberDeliveryCallbackSchema = z.object({ event: z.enum(['delivered', 'seen', 'failed']), message_token: z.string().regex(/^[0-9]+$/) }).passthrough();
export const viberCallbackSchema = z.object({
  event: z.string().optional(), context: z.string().optional(), user_id: z.string().optional(),
  user: z.object({ id: z.string().optional() }).passthrough().optional(),
  sender: z.object({ id: z.string().optional() }).passthrough().optional(),
  message: z.object({ text: z.string().optional() }).passthrough().optional(),
}).passthrough();
export type ViberCallback = z.infer<typeof viberCallbackSchema>;
export const resendWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({ email_id: z.string().min(1) }).passthrough(),
}).passthrough();
