"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditLogFilters,
  PrismApprovalRequest,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismSecurityAlert,
  PrismAuthenticatedSession,
  PrismUser,
} from "@prism/types";
import { readStoredEventSession } from "@/app/lib/session";
import {
  auditActionTypes,
  auditCategories,
  auditDateRanges,
} from "@/features/pmcm-kit";
import { createAuditTrailRepository } from "../data/audit-trail-repository";
import { downloadAuditLog } from "../use-cases/export-audit-log";
import { summarizeAuditTrail } from "../model/audit-trail-rules";

export function useAuditTrailViewModel() {
  const repository = useMemo(() => createAuditTrailRepository(), []);
  const [session, setSession] = useState<PrismAuthenticatedSession | null>(null);
  const [events, setEvents] = useState<PrismEvent[]>([]);
  const [users, setUsers] = useState<PrismUser[]>([]);
  const [logs, setLogs] = useState<PrismAuditLog[]>([]);
  const [alerts, setAlerts] = useState<PrismSecurityAlert[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<PrismAuditIntegrity | null>(null);
  const [privacyInventory, setPrivacyInventory] = useState<PrismPrivacyInventory | null>(null);
  const [privacySubmittedCount, setPrivacySubmittedCount] = useState(0);
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);
  const [loginHistory, setLoginHistory] = useState<PrismLoginHistory[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [actor, setActor] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(readStoredEventSession());
  }, []);

  const refreshUsers = useCallback(() => repository.loadContext()
    .then(({ events: nextEvents, users: nextUsers }) => {
      setEvents(nextEvents);
      setUsers(nextUsers);
    })
    .catch(() => undefined), [repository]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const filters = useMemo<AuditLogFilters>(() => ({
    query,
    category,
    eventId,
    actor,
    actionType,
    severity,
    dateRange,
    limit: "120",
  }), [query, category, eventId, actor, actionType, severity, dateRange]);

  const refreshAudit = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const next = await repository.load(filters, session.id, eventId);
      setLogs(next.logs);
      setAlerts(next.alerts);
      setLoginHistory(next.loginHistory);
      setAuditIntegrity(next.auditIntegrity);
      setPrivacyInventory(next.privacyInventory);
      setApprovalRequests(next.approvalRequests);
      setPrivacySubmittedCount(next.privacySubmittedCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit trail");
    } finally {
      setBusy(false);
    }
  }, [eventId, filters, repository, session]);

  useEffect(() => {
    void refreshAudit();
  }, [refreshAudit]);

  const exportLog = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      downloadAuditLog(await repository.export(filters));
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export audit log");
    } finally {
      setBusy(false);
    }
  }, [filters, refreshAudit, repository]);

  const summary = useMemo(() => summarizeAuditTrail({
    logs,
    alerts,
    loginHistory,
    approvalRequests,
    privacySubmittedCount,
    privacyInventory,
  }), [alerts, approvalRequests, loginHistory, logs, privacyInventory, privacySubmittedCount]);

  return {
    session,
    events,
    users,
    logs,
    alerts,
    auditIntegrity,
    privacyInventory,
    approvalRequests,
    loginHistory,
    query,
    setQuery,
    category,
    setCategory,
    eventId,
    setEventId,
    actor,
    setActor,
    actionType,
    setActionType,
    severity,
    setSeverity,
    dateRange,
    setDateRange,
    advancedOpen,
    setAdvancedOpen,
    busy,
    error,
    status: busy ? ("loading" as const) : error ? ("error" as const) : ("idle" as const),
    filters,
    auditCategories,
    auditActionTypes,
    auditDateRanges,
    refreshAudit,
    refreshUsers,
    exportLog,
    ...summary,
  };
}
