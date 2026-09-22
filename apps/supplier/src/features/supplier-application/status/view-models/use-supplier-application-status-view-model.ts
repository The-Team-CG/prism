"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismSupplierApplicationStatusResult, SupplierApplicationStatusQuery } from "@prism/types";
import { getSupplierApplicationStatus } from "../use-cases/get-supplier-application-status";
import {
  isAbortError,
  isTerminalSupplierApplicationStatus,
  mapSupplierApplicationStatusFailure,
  type SupplierApplicationStatusFailure,
} from "../model/supplier-application-status-rules";

const STATUS_REFRESH_INTERVAL_MS = 5_000;

type StatusLookupPhase = "idle" | "checking" | "refreshing";

function hasOnlineConnection(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

function canRefreshInBackground(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useSupplierApplicationStatusViewModel() {
  const [applicationId, setApplicationId] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState<SupplierApplicationStatusQuery | null>(null);
  const [result, setResult] = useState<PrismSupplierApplicationStatusResult | null>(null);
  const [failure, setFailure] = useState<SupplierApplicationStatusFailure | null>(null);
  const [phase, setPhase] = useState<StatusLookupPhase>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current === null) return;
    clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  }, []);

  const cancelLookup = useCallback(() => {
    requestSequence.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    clearRefreshTimer();
  }, [clearRefreshTimer]);

  const clearLookup = useCallback(() => {
    cancelLookup();
    setQuery(null);
    setResult(null);
    setFailure(null);
    setPhase("idle");
    setLastCheckedAt(null);
  }, [cancelLookup]);

  const runStatusCheck = useCallback(
    async (nextQuery: SupplierApplicationStatusQuery, mode: "lookup" | "refresh") => {
      clearRefreshTimer();
      activeController.current?.abort();
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      const controller = new AbortController();
      activeController.current = controller;
      setPhase(mode === "refresh" ? "refreshing" : "checking");
      if (mode === "lookup") {
        setResult(null);
        setFailure(null);
        setLastCheckedAt(null);
      }

      try {
        const nextResult = await getSupplierApplicationStatus(nextQuery, controller.signal);
        if (sequence !== requestSequence.current) return;
        setResult(nextResult);
        setFailure(null);
        setLastCheckedAt(new Date());
      } catch (error) {
        if (sequence !== requestSequence.current || isAbortError(error)) return;
        const nextFailure = mapSupplierApplicationStatusFailure(error);
        setFailure(nextFailure);
        if (nextFailure === "not_found" || nextFailure === "invalid_input") setResult(null);
      } finally {
        if (sequence !== requestSequence.current) return;
        activeController.current = null;
        setPhase("idle");
      }
    },
    [clearRefreshTimer],
  );

  useEffect(() => {
    if (!query || !result || isTerminalSupplierApplicationStatus(result.status)) return;
    let disposed = false;

    const scheduleRefresh = () => {
      clearRefreshTimer();
      if (disposed || !canRefreshInBackground() || !hasOnlineConnection()) return;
      refreshTimer.current = setTimeout(() => {
        void runStatusCheck(query, "refresh").finally(() => {
          if (!disposed) scheduleRefresh();
        });
      }, STATUS_REFRESH_INTERVAL_MS);
    };

    const refreshWhenAvailable = () => {
      if (!canRefreshInBackground() || !hasOnlineConnection()) {
        clearRefreshTimer();
        return;
      }
      void runStatusCheck(query, "refresh").finally(() => {
        if (!disposed) scheduleRefresh();
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWhenAvailable();
      else clearRefreshTimer();
    };
    const handleOnline = () => refreshWhenAvailable();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    scheduleRefresh();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, failure, query, result, runStatusCheck]);

  useEffect(() => () => cancelLookup(), [cancelLookup]);

  async function submit() {
    const nextQuery = { applicationId: applicationId.trim(), email: email.trim() };
    setQuery(nextQuery);
    await runStatusCheck(nextQuery, "lookup");
  }

  async function retry() {
    if (!query) return;
    await runStatusCheck(query, "refresh");
  }

  return {
    applicationId,
    email,
    result,
    failure,
    phase,
    busy: phase !== "idle",
    lastCheckedAt,
    setApplicationId: (value: string) => {
      setApplicationId(value);
      if (query) clearLookup();
    },
    setEmail: (value: string) => {
      setEmail(value);
      if (query) clearLookup();
    },
    submit,
    retry,
  };
}
