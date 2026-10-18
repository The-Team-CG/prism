"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismPmcmSupplierWorkflowWorkspace, PrismSupplierQuote } from "@prism/types";
import {
  assignSupplierCreativeTask,
  createSupplierPayable,
  downloadPmcmSupplierFile,
  loadPmcmSupplierWorkflows,
  publishSupplierSchedule,
  recordSupplierPayout,
  reviewSupplierContract,
  reviewSupplierCreativeTask,
  reverseSupplierPayout,
} from "../use-cases/pmcm-supplier-workflow-actions";

type Drafts = Record<string, Record<string, string>>;

function asIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function usePmcmSupplierWorkflows(eventId: string) {
  const [loaded, setLoaded] = useState<{ eventId: string; rows: PrismPmcmSupplierWorkflowWorkspace[] } | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const eventIdRef = useRef(eventId);
  const loadSequence = useRef(0);
  eventIdRef.current = eventId;

  const load = useCallback(async () => {
    const requestedEventId = eventId;
    const sequence = ++loadSequence.current;
    try {
      const rows = await loadPmcmSupplierWorkflows(requestedEventId);
      if (eventIdRef.current === requestedEventId && loadSequence.current === sequence) {
        setLoaded({ eventId: requestedEventId, rows });
        setError(null);
      }
      return rows;
    } catch (cause) {
      if (eventIdRef.current === requestedEventId && loadSequence.current === sequence) {
        setError(cause instanceof Error ? cause.message : "Unable to load supplier workflows");
      }
      throw cause;
    }
  }, [eventId]);

  useEffect(() => {
    setLoaded(null);
    setDrafts({});
    setError(null);
    setNotice(null);
    setBusy(false);
    void load().catch(() => undefined);
  }, [eventId, load]);

  const run = useCallback(async (label: string, action: () => Promise<unknown>) => {
    if (eventIdRef.current !== eventId) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      try {
        await load();
      } catch {
        if (eventIdRef.current === eventId) setError(`${label} was saved, but the updated supplier workflow could not be loaded. Reload before retrying.`);
        return false;
      }
      if (eventIdRef.current === eventId) setNotice(label);
      return true;
    } catch (cause) {
      if (eventIdRef.current === eventId) setError(cause instanceof Error ? cause.message : "Supplier workflow action failed");
      return false;
    } finally {
      if (eventIdRef.current === eventId) setBusy(false);
    }
  }, [eventId, load]);

  const value = useCallback((key: string, field: string) => drafts[key]?.[field] ?? "", [drafts]);
  const setValue = useCallback((key: string, field: string, next: string) => {
    if (eventIdRef.current !== eventId) return;
    setDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: next } }));
  }, [eventId]);

  const clearValues = useCallback((key: string, fields: string[]) => {
    setDrafts((current) => {
      const next = { ...current[key] };
      fields.forEach((field) => { next[field] = ""; });
      return { ...current, [key]: next };
    });
  }, []);

  const idempotencyKeyFor = useCallback((draftKey: string, action: string, payload: unknown) => {
    const payloadField = `${action}Payload`;
    const keyField = `${action}Key`;
    const fingerprint = JSON.stringify(payload);
    const existing = value(draftKey, keyField);
    if (existing && value(draftKey, payloadField) === fingerprint) return existing;
    const next = crypto.randomUUID();
    setValue(draftKey, keyField, next);
    setValue(draftKey, payloadField, fingerprint);
    return next;
  }, [setValue, value]);

  const publishSchedule = useCallback(async (requestId: string) => {
    const key = `schedule:${requestId}`;
    const saved = await run("Supplier schedule published", () => publishSupplierSchedule(eventId, {
      requestId,
      ingressAt: asIsoDateTime(value(key, "ingressAt")) ?? "",
      egressAt: asIsoDateTime(value(key, "egressAt")) ?? "",
      location: value(key, "location"),
      notes: value(key, "notes"),
    }));
    if (saved) clearValues(key, ["ingressAt", "egressAt", "location", "notes"]);
    return saved;
  }, [clearValues, eventId, run, value]);

  const decideContract = useCallback((versionId: string, decision: "accepted" | "changes_requested") => {
    const key = versionId;
    return run(decision === "accepted" ? "Contract accepted" : "Correction requested", () => reviewSupplierContract(versionId, {
      decision,
      reason: value(key, "reason"),
    }));
  }, [run, value]);

  const assignTask = useCallback(async (requestId: string) => {
    const key = `task:${requestId}`;
    const payload = {
      requestId,
      title: value(key, "title"),
      brief: value(key, "brief"),
      dueAt: asIsoDateTime(value(key, "dueAt")),
    };
    const idempotencyKey = idempotencyKeyFor(key, "assign", payload);
    const saved = await run("Supplier deliverable assigned", () => assignSupplierCreativeTask(eventId, {
      ...payload,
      idempotencyKey,
    }));
    if (saved) clearValues(key, ["title", "brief", "dueAt", "assignKey", "assignPayload"]);
    return saved;
  }, [clearValues, eventId, idempotencyKeyFor, run, value]);

  const decideTask = useCallback((taskId: string, status: "accepted" | "changes_requested") => run(
    status === "accepted" ? "Deliverable accepted" : "Revision requested",
    () => reviewSupplierCreativeTask(taskId, { status, reviewNote: value(taskId, "reviewNote") }),
  ), [run, value]);

  const addPayable = useCallback(async (requestId: string, quote: PrismSupplierQuote) => {
    const key = `payable:${requestId}`;
    const payable = {
      requestId,
      quoteId: quote.id,
      label: value(key, "label"),
      amount: Number(value(key, "amount")),
      dueDate: value(key, "dueDate") ? new Date(`${value(key, "dueDate")}T00:00:00.000Z`).toISOString() : null,
    };
    const idempotencyKey = idempotencyKeyFor(key, "create", payable);
    const saved = await run("Supplier payable milestone saved", () => createSupplierPayable(eventId, {
      ...payable,
      idempotencyKey,
    }));
    if (saved) clearValues(key, ["label", "amount", "dueDate", "createKey", "createPayload"]);
    return saved;
  }, [clearValues, eventId, idempotencyKeyFor, run, value]);

  const releasePayout = useCallback(async (milestoneId: string) => {
    const key = milestoneId;
    const release = {
      amount: Number(value(key, "amount")),
      paymentDate: new Date(`${value(key, "paymentDate")}T00:00:00.000Z`).toISOString(),
      method: value(key, "method"),
      referenceNumber: value(key, "referenceNumber"),
    };
    const idempotencyKey = idempotencyKeyFor(key, "release", release);
    const saved = await run("Payment release recorded", () => recordSupplierPayout(milestoneId, {
      ...release,
      idempotencyKey,
    }));
    if (saved) clearValues(key, ["amount", "paymentDate", "method", "referenceNumber", "releaseKey", "releasePayload"]);
    return saved;
  }, [clearValues, idempotencyKeyFor, run, value]);

  const reversePayout = useCallback(async (recordId: string) => {
    const key = recordId;
    const paymentDate = value(key, "reversePaymentDate") || new Date().toISOString();
    if (!value(key, "reversePaymentDate")) setValue(key, "reversePaymentDate", paymentDate);
    const reversal = { paymentDate, reason: value(key, "reverseReason") };
    const idempotencyKey = idempotencyKeyFor(key, "reverse", reversal);
    const saved = await run("Payment reversal recorded", () => reverseSupplierPayout(recordId, {
      ...reversal,
      idempotencyKey,
    }));
    if (saved) clearValues(key, ["reverseReason", "reverseKey", "reversePayload", "reversePaymentDate"]);
    return saved;
  }, [clearValues, idempotencyKeyFor, run, setValue, value]);

  const download = useCallback(async (objectId: string) => {
    setError(null);
    try {
      const file = await downloadPmcmSupplierFile(objectId);
      if (eventIdRef.current !== eventId) return;
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (eventIdRef.current === eventId) setError(cause instanceof Error ? cause.message : "Unable to download supplier file");
    }
  }, [eventId]);

  return {
    rows: loaded?.eventId === eventId ? loaded.rows : [],
    isLoading: loaded?.eventId !== eventId && error === null,
    error,
    notice,
    busy,
    value,
    setValue,
    load,
    publishSchedule,
    decideContract,
    assignTask,
    decideTask,
    addPayable,
    releasePayout,
    reversePayout,
    download,
  };
}
