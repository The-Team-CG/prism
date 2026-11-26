"use client";

import { useEffect, useMemo, useState } from "react";
import { useInvalidate } from "@prism/portal-query";
import { verifyPaymentReceiptSchema, type PrismFinanceDesk, type PrismFinanceDeskItem } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { readStoredEventSession } from "@/app/lib/session";
import { financeDeskCommands, financeDeskLastSeenStore } from "../data/finance-desk-commands";
import { financeDesk } from "../data/finance-desk-resource";
import { filterQueue, isNewSince, queueGroupCounts, receivablesCsv, type QueueGroup } from "../model/finance-desk-analysis";

/** The desk's last visit, read once; opening the desk records this visit for next time but keeps today's marks. */
function useLastVisit() {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  useEffect(() => {
    const actorId = readStoredEventSession()?.id;
    if (!actorId) return;
    setLastSeen(financeDeskLastSeenStore.get(actorId));
    financeDeskLastSeenStore.set(actorId, new Date().toISOString());
  }, []);
  return lastSeen;
}

/** Verify one or many client payments with one note. Each is verified on its own, so one failure does not stop the rest. */
function useVerify(onDone: () => void) {
  const invalidate = useInvalidate();
  const [targets, setTargets] = useState<PrismFinanceDeskItem[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifiedReceiptId, setVerifiedReceiptId] = useState<string | null>(null);

  async function submit() {
    const parsed = verifyPaymentReceiptSchema.safeParse({ notes: note });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Say what was checked");
    setBusy(true);
    const results = await Promise.allSettled(targets.map((item) => financeDeskCommands.verify(item.receiptId ?? "", parsed.data)));
    setBusy(false);
    const failed = results.filter((result) => result.status === "rejected").length;
    const verified = results.length - failed;
    setVerifiedReceiptId(targets.length === 1 && verified === 1 ? targets[0]?.receiptId ?? null : null);
    if (verified) toast.success(verified === 1 ? "Payment verified. The client has been told." : `${verified} payments verified. Each client has been told.`);
    if (failed) toast.error(failed === 1 ? "One payment could not be verified. Open it to see why." : `${failed} payments could not be verified. Open them to see why.`);
    setTargets([]);
    setNote("");
    setError(null);
    onDone();
    void invalidate(financeDesk);
  }

  return {
    targets,
    open: (items: PrismFinanceDeskItem[]) => { setTargets(items); setError(null); },
    close: () => setTargets([]),
    note,
    setNote,
    error,
    busy,
    verifiedReceiptId,
    submit,
  };
}

function useRemind() {
  const [busyId, setBusyId] = useState<string | null>(null);
  async function remind(item: PrismFinanceDeskItem) {
    if (!item.eventId || !item.milestoneId) return;
    setBusyId(item.id);
    try {
      const result = await financeDeskCommands.remind(item.eventId, item.milestoneId);
      if (result.alreadySentToday) toast.info("This client was already reminded about this payment today.");
      else toast.success(`Reminder sent to the client${item.eventName ? ` of ${item.eventName}` : ""}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not send the reminder.");
    } finally {
      setBusyId(null);
    }
  }
  return { remind, busyId };
}

function downloadCsv(desk: PrismFinanceDesk, todayKey: string) {
  const blob = new Blob([`﻿${receivablesCsv(desk.events, todayKey)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `client-receivables-${todayKey}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export const canVerify = (item: PrismFinanceDeskItem) => item.kind === "verify_payment" && Boolean(item.receiptId);
export const canRemind = (item: PrismFinanceDeskItem) => item.kind === "client_overdue" && Boolean(item.milestoneId);

/** The desk's queue tools: filter and search, "new since your last visit", selection for bulk verify, and inline actions. */
export function useFinanceDeskViewModel(desk: PrismFinanceDesk, todayKey: string) {
  const [group, setGroup] = useState<QueueGroup>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastSeen = useLastVisit();
  const verify = useVerify(() => setSelected(new Set()));
  const reminders = useRemind();

  const items = useMemo(() => filterQueue(desk.queue, group, query), [desk.queue, group, query]);
  const counts = useMemo(() => queueGroupCounts(desk.queue), [desk.queue]);
  const verifiable = items.filter(canVerify);
  const selectedItems = desk.queue.filter((item) => selected.has(item.id) && canVerify(item));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return {
    group, setGroup, query, setQuery, items, counts,
    isNew: (item: PrismFinanceDeskItem) => isNewSince(item, lastSeen),
    selected, toggle, selectedItems,
    allSelected: verifiable.length > 0 && verifiable.every((item) => selected.has(item.id)),
    selectAll: (on: boolean) => setSelected(on ? new Set(verifiable.map((item) => item.id)) : new Set()),
    clearSelection: () => setSelected(new Set()),
    verify,
    reminders,
    exportCsv: () => downloadCsv(desk, todayKey),
  };
}

export type FinanceDeskViewModel = ReturnType<typeof useFinanceDeskViewModel>;
