"use client";

import { useCallback, useEffect, useState } from "react";

import type { PrismRetentionPolicy, PrismRetentionReviewItem } from "@prism/types";
import { canDismissReviewItem, canEnablePolicy, canExecuteReviewItem, parsePeriodDays } from "../model/retention-rules";
import { retentionUseCases, type ReviewStatusFilter } from "../use-cases/retention-use-cases";

export type RetentionMessage = { tone: "error" | "notice"; text: string };

type UseCases = typeof retentionUseCases;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "The retention request could not be completed.";
}

export function usePrivacyRetentionViewModel(useCases: UseCases = retentionUseCases) {
  const [policies, setPolicies] = useState<PrismRetentionPolicy[]>([]);
  const [items, setItems] = useState<PrismRetentionReviewItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("pending");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<RetentionMessage | null>(null);
  const [periodDrafts, setPeriodDrafts] = useState<Record<string, string>>({});
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async (status: ReviewStatusFilter) => {
    setBusy(true);
    try {
      const loaded = await useCases.load(status);
      setPolicies(loaded.policies);
      setItems(loaded.items);
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }, [useCases]);

  useEffect(() => {
    void load(statusFilter);
  }, [load, statusFilter]);

  const runAndReload = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "notice", text: success });
      const loaded = await useCases.load(statusFilter);
      setPolicies(loaded.policies);
      setItems(loaded.items);
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = (policy: PrismRetentionPolicy, change: { enabled?: boolean; usePeriodDraft?: boolean }) => {
    const reason = (reasonDrafts[policy.category] ?? "").trim();
    if (!reason) {
      setMessage({ tone: "error", text: "Enter a reason before changing this policy." });
      return;
    }
    let periodDays: number | undefined;
    if (change.usePeriodDraft) {
      const parsed = parsePeriodDays(periodDrafts[policy.category] ?? String(policy.periodDays));
      if (parsed === null) {
        setMessage({ tone: "error", text: "Retention periods must be whole days between 30 and 3650." });
        return;
      }
      periodDays = parsed;
    }
    void runAndReload(
      () => useCases.updatePolicy(policy, { reason, ...(change.enabled !== undefined ? { enabled: change.enabled } : {}), ...(periodDays !== undefined ? { periodDays } : {}) }),
      "Retention policy saved.",
    );
  };

  const executeItem = (item: PrismRetentionReviewItem) => {
    void runAndReload(() => useCases.executeItem(item, notesDrafts[item.id] ?? ""), "Review item executed. Only the listed records were redacted.");
  };

  const dismissItem = (item: PrismRetentionReviewItem) => {
    const reason = (reasonDrafts[item.id] ?? "").trim();
    if (!reason) {
      setMessage({ tone: "error", text: "A dismissal reason is required." });
      return;
    }
    void runAndReload(() => useCases.dismissItem(item, reason), "Review item dismissed.");
  };

  return {
    policies,
    items,
    statusFilter,
    busy,
    message,
    setStatusFilter,
    periodDrafts,
    setPeriodDraft: (category: string, value: string) => setPeriodDrafts((current) => ({ ...current, [category]: value })),
    reasonDrafts,
    setReasonDraft: (key: string, value: string) => setReasonDrafts((current) => ({ ...current, [key]: value })),
    notesDrafts,
    setNotesDraft: (itemId: string, value: string) => setNotesDrafts((current) => ({ ...current, [itemId]: value })),
    canEnable: canEnablePolicy,
    canExecute: canExecuteReviewItem,
    canDismiss: canDismissReviewItem,
    savePolicy,
    executeItem,
    dismissItem,
  };
}

export type PrivacyRetentionViewModel = ReturnType<typeof usePrivacyRetentionViewModel>;
