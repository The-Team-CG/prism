"use client";

import { useEffect, useState } from "react";
import { billingDocumentsRepository } from "../data/billing-documents-repository";

export type PaymentQr =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; url: string; blob: Blob }
  | { status: "error"; message: string };

/** Loads a payment QR the statement shows, through the client's own session, into a local object URL released when it changes. */
export function usePaymentQr(eventId: string, imageId: string | null, enabled: boolean): PaymentQr {
  const [qr, setQr] = useState<PaymentQr>({ status: "none" });
  useEffect(() => {
    if (!imageId || !enabled) {
      setQr({ status: "none" });
      return;
    }
    let active = true;
    let url: string | null = null;
    setQr({ status: "loading" });
    billingDocumentsRepository.paymentQr(eventId, imageId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setQr({ status: "ready", url, blob });
      })
      .catch((reason: unknown) => {
        if (active) setQr({ status: "error", message: reason instanceof Error ? reason.message : "The QR could not be loaded." });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [eventId, imageId, enabled]);
  return qr;
}
