import { eventApi } from "@/lib/prism-api";

export const notificationDeliveryRepository = {
  requestAcknowledgment: (deliveryId: string, input: import('@prism/types').RequestNotificationAcknowledgmentInput) => eventApi.audit.requestNotificationAcknowledgment(deliveryId, input),
  refresh: (notificationId: string, deliveryId: string) => eventApi.audit.refreshNotificationOutcome(notificationId, deliveryId),
  list: (notificationId: string) => eventApi.audit.notificationDeliveries(notificationId),
  retry: (notificationId: string, input: import("@prism/types").RetryNotificationInput) => eventApi.audit.retryNotification(notificationId, input),
};
