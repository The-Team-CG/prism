"use client";

import { useResource } from "@prism/portal-query";
import { financeEventAddenda } from "../data/finance-addenda-resource";
import { pendingBillingAddendumLine, pendingBillingAddenda } from "../model/pending-addenda";

export function usePendingAddendaViewModel(eventId: string) {
  const addenda = useResource(financeEventAddenda, eventId);
  const lines = pendingBillingAddenda(addenda.data ?? []).map(pendingBillingAddendumLine);
  return { status: addenda.status, lines };
}
