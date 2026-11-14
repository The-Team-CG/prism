"use client";

import { useEffect, useState } from "react";
import type { PrismCommunicationReadReceipt } from "@prism/types";

type ReceiptSource = (threadId: string) => Promise<PrismCommunicationReadReceipt[]>;
type ReadState = { scope: string; threadId: string; rows: PrismCommunicationReadReceipt[] };

/** Only a source authorized to expose read receipts supplies this loader. Hidden tabs do not poll. */
export function useConversationReadReceipts({ scope, threadId, load }: { scope: string; threadId?: string; load?: ReceiptSource }) {
  const [state, setState] = useState<ReadState | null>(null);
  useEffect(() => {
    if (!threadId || !load) return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || pending) return;
      pending = true;
      try {
        const rows = await load(threadId);
        if (active) setState({ scope, threadId, rows });
      } catch {
        if (active) setState({ scope, threadId, rows: [] });
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [scope, threadId, load]);
  return load && state?.scope === scope && state.threadId === threadId ? state.rows : null;
}
