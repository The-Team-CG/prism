"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrismSupplierPayableMilestone } from "@prism/types";
import { supplierPaymentsLastSeenStore } from "../data/supplier-payments-last-seen-store";
import { newPayoutReleases } from "../model/supplier-payments";

/**
 * New payouts for the Payments badge. Opening Payments marks them seen for next time, but keeps them marked "New"
 * on the page during this visit.
 */
export function useNewPayouts(actorId: string | undefined, payables: PrismSupplierPayableMilestone[], onPayments: boolean) {
  const [seenBefore, setSeenBefore] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!actorId) return;
    setSeenBefore(supplierPaymentsLastSeenStore.get(actorId));
    setLoaded(true);
  }, [actorId]);
  useEffect(() => {
    if (actorId && loaded && onPayments) supplierPaymentsLastSeenStore.set(actorId, new Date().toISOString());
  }, [actorId, loaded, onPayments]);
  const fresh = useMemo(() => (loaded ? newPayoutReleases(payables, seenBefore) : new Set<string>()), [loaded, payables, seenBefore]);
  return { fresh, badgeCount: onPayments ? 0 : fresh.size };
}
