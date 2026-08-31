"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditLogFilters,
  CreatePrivacyRequestInput,
  PrismApprovalRequest,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismSecurityAlert,
  PrismAuthenticatedSession,
  PrismUser,
  ReviewPrivacyRequestInput,
} from "@prism/types";
import { readStoredEventSession } from "@/app/lib/session";
import { useEventOpsCommands } from "@/features/event-ops";
import {
  auditActionTypes,
  auditCategories,
  auditDateRanges,
} from "@/features/pmcm-kit";
import { createAuditTrailRepository } from "../data/audit-trail-repository";
import { downloadAuditLog } from "../use-cases/export-audit-log";
import { summarizeAuditTrail } from "../model/audit-trail-rules";

type PrivacyForm = Pick<CreatePrivacyRequestInput, "subjectType" | "requestType" | "subjectEmail" | "subjectName" | "requestNotes">;

const initialPrivacyForm: PrivacyForm = {
  subjectType: "guest",
  requestType: "deletion",
  subjectEmail: "",
  subjectName: "",
  requestNotes: "",
};

/**
 * Self-sufficient audit trail ViewModel: reads its own verified session and
 * loads the PMCM event/user roster it needs directly, instead of depending
 * on the dashboard shell VM to prop-drill them in (see
 * docs/reviews/2026-09-01-fe-be-architecture-alignment.md, finding F4c).
 */
export function useAuditTrailViewModel() {
  const commands = useEventOpsCommands();
  const repository = useMemo(() => createAuditTrailRepository(commands), [commands]);
  const [session, setSession] = useState<PrismAuthenticatedSession | null>(null);
  const [events, setEvents] = useState<PrismEvent[]>([]);
  const [users, setUsers] = useState<PrismUser[]>([]);
  const [logs, setLogs] = useState<PrismAuditLog[]>([]);
  const [alerts, setAlerts] = useState<PrismSecurityAlert[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<PrismAuditIntegrity | null>(null);
  const [privacyInventory, setPrivacyInventory] = useState<PrismPrivacyInventory | null>(null);
  const [privacyPolicies, setPrivacyPolicies] = useState<PrismPrivacyRetentionPolicy[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrismPrivacyRequest[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);
  const [loginHistory, setLoginHistory] = useState<PrismLoginHistory[]>([]);
  const [privacyForm, setPrivacyForm] = useState<PrivacyForm>(initialPrivacyForm);
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

  useEffect(() => {
    let cancelled = false;
    commands
      .pmcmState()
      .then((state) => {
        if (cancelled) return;
        setEvents(state.events);
        setUsers(state.users);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [commands]);

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
      setPrivacyPolicies(next.privacyPolicies);
      setPrivacyRequests(next.privacyRequests);
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

  const logPrivacyRequest = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await repository.createPrivacyRequest({
        ...privacyForm,
        eventId: eventId !== "all" ? eventId : undefined,
      });
      setPrivacyForm((current) => ({ ...current, subjectEmail: "", subjectName: "", requestNotes: "" }));
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log privacy request");
    } finally {
      setBusy(false);
    }
  }, [eventId, privacyForm, refreshAudit, repository]);

  const reviewPrivacyRequest = useCallback(async (requestId: string, status: ReviewPrivacyRequestInput["status"]) => {
    setBusy(true);
    setError(null);
    try {
      await repository.reviewPrivacyRequest(requestId, {
        status,
        reviewReason: status === "approved" ? "Validated by PMCM privacy review." : "Rejected by PMCM privacy review.",
      });
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review privacy request");
    } finally {
      setBusy(false);
    }
  }, [refreshAudit, repository]);

  const executePrivacyRequest = useCallback(async (requestId: string) => {
    setBusy(true);
    setError(null);
    try {
      await repository.executePrivacyRequest(requestId, "Executed from PMCM privacy operations panel.");
      await refreshAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to execute privacy request");
    } finally {
      setBusy(false);
    }
  }, [refreshAudit, repository]);

  const summary = useMemo(() => summarizeAuditTrail({
    logs,
    alerts,
    loginHistory,
    approvalRequests,
    privacyRequests,
    privacyInventory,
  }), [alerts, approvalRequests, loginHistory, logs, privacyInventory, privacyRequests]);

  return {
    session,
    events,
    users,
    logs,
    alerts,
    auditIntegrity,
    privacyInventory,
    privacyPolicies,
    privacyRequests,
    approvalRequests,
    loginHistory,
    privacyForm,
    setPrivacyForm,
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
    exportLog,
    logPrivacyRequest,
    reviewPrivacyRequest,
    executePrivacyRequest,
    ...summary,
  };
}
