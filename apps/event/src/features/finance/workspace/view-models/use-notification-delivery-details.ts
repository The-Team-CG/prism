"use client";

import { useState } from "react";
import type { PrismNotificationRecipientDelivery } from "@prism/types";
import { parseContract, retryNotificationSchema, requestNotificationAcknowledgmentSchema } from "@prism/types";
import { notificationDeliveryRepository } from "../data/notification-delivery-repository";

export function useNotificationDeliveryDetails(notificationId: string) {
  const [rows, setRows] = useState<PrismNotificationRecipientDelivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  async function load() {
    setBusy(true);
    setError(null);
    try { setRows(await notificationDeliveryRepository.list(notificationId)); }
    catch { setError("Unable to load recipient delivery details."); }
    finally { setBusy(false); }
  }
  async function retry(reason: string) {
    setBusy(true);
    setError(null);
    try {
      await notificationDeliveryRepository.retry(notificationId, parseContract(retryNotificationSchema, { reason }, "Retry"));
      setQueued(true);
      setRows(await notificationDeliveryRepository.list(notificationId));
    } catch { setError("Unable to retry this notification. Refresh and try again."); }
    finally { setBusy(false); }
  }
  async function refresh(deliveryId: string) {
    setBusy(true); setError(null);
    try { await notificationDeliveryRepository.refresh(notificationId, deliveryId); setRows(await notificationDeliveryRepository.list(notificationId)); }
    catch { setError('Provider outcome reporting is unavailable. Check that external email delivery is configured.'); }
    finally { setBusy(false); }
  }
  async function requestAcknowledgment(deliveryId: string, dueAt: string, reason: string) {
    setBusy(true); setError(null);
    try {
      await notificationDeliveryRepository.requestAcknowledgment(deliveryId, parseContract(requestNotificationAcknowledgmentSchema, { dueAt: new Date(dueAt).toISOString(), reason }, 'Acknowledgment deadline'));
      setRows(await notificationDeliveryRepository.list(notificationId));
    } catch { setError('Unable to set the acknowledgment deadline. Choose a future date and provide a reason.'); }
    finally { setBusy(false); }
  }
  return { rows, error, busy, queued, load, retry, refresh, requestAcknowledgment };
}
