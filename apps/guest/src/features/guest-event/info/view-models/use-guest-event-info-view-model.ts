"use client";

import { useEffect, useState } from "react";
import type { PrismGuestEventPass } from "@prism/types";
import { mapGuestEventInfoError } from "../model/guest-event-info-rules";
import type { GuestEventInfoRow, GuestEventInfoStatus } from "../model/guest-event-info-types";
import { loadGuestEventInfo } from "../use-cases/guest-event-info-load";

export function useGuestEventInfoViewModel(accessCode: string) {
  const [event, setEvent] = useState<PrismGuestEventPass | null>(null);
  const [infoRows, setInfoRows] = useState<GuestEventInfoRow[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<GuestEventInfoStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadGuestEventInfo(accessCode)
      .then((result) => {
        if (cancelled) return;
        setEvent(result.event);
        setInfoRows(result.infoRows);
        setQrUrl(result.qrUrl);
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvent(null);
        setInfoRows([]);
        setQrUrl(null);
        setStatus("error");
        setError(mapGuestEventInfoError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [accessCode]);

  return { event, infoRows, qrUrl, status, error };
}
