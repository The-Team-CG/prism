"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPrivacyLegalHoldSchema,
  type CreatePrivacyLegalHoldInput,
  type CreatePrivacyRequestInput,
  type PrismAuthenticatedSession,
  type PrismEvent,
  type PrismPrivacyLegalHold,
  type PrismPrivacyRequest,
  type PrismUser,
  type ReviewPrivacyRequestInput,
} from "@prism/types";
import { readStoredEventSession } from "@/app/lib/session";
import { privacyConsoleRepository, type PrivacyConsoleRepository } from "../data/privacy-console-repository";
import { parsePrivacyCorrectionDraft, type PrivacyCorrectionDraft } from "../model/privacy-correction";
import { downloadPrivacyExportBundle } from "../model/privacy-export-download";
import {
  initialPrivacyConsoleFilters,
  PRIVACY_CONSOLE_PAGE_SIZE,
  privacyQueueQuery,
  type PrivacyConsoleFilters,
} from "../model/privacy-console-rules";

type PrivacyForm = Pick<CreatePrivacyRequestInput, "subjectType" | "requestType" | "subjectEmail" | "subjectName" | "requestNotes">;

const initialPrivacyForm: PrivacyForm = {
  subjectType: "guest",
  requestType: "deletion",
  subjectEmail: "",
  subjectName: "",
  requestNotes: "",
};

type PrivacyLegalHoldForm = Pick<CreatePrivacyLegalHoldInput, "subjectType" | "subjectEmail" | "subjectName" | "reason"> & {
  eventScope: "subject" | "event";
};

const initialLegalHoldForm: PrivacyLegalHoldForm = {
  subjectType: "client",
  subjectEmail: "",
  subjectName: "",
  reason: "",
  eventScope: "subject",
};

/**
 * PMCM privacy operations console state. Reads the verified session, loads one page of the request queue for the
 * current filters, and owns the request, assignment, legal-hold, and execution commands. Pages and views stay thin.
 */
export function usePrivacyConsoleViewModel(repository: PrivacyConsoleRepository = privacyConsoleRepository) {
  const [session, setSession] = useState<PrismAuthenticatedSession | null>(null);
  const [events, setEvents] = useState<PrismEvent[]>([]);
  const [users, setUsers] = useState<PrismUser[]>([]);
  const [filters, setFilters] = useState<PrivacyConsoleFilters>(initialPrivacyConsoleFilters);
  const [page, setPage] = useState(0);
  const [requests, setRequests] = useState<PrismPrivacyRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [legalHolds, setLegalHolds] = useState<PrismPrivacyLegalHold[]>([]);
  const [privacyForm, setPrivacyForm] = useState<PrivacyForm>(initialPrivacyForm);
  const [legalHoldForm, setLegalHoldForm] = useState<PrivacyLegalHoldForm>(initialLegalHoldForm);
  const [legalHoldReleaseReasons, setLegalHoldReleaseReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const isPmcmAdmin = session?.role === "pmcm-admin";
  const operatorId = session?.id ?? null;
  const scopeEventId = filters.eventId;

  useEffect(() => {
    setSession(readStoredEventSession());
    let cancelled = false;
    repository.loadContext()
      .then((context) => {
        if (cancelled) return;
        setEvents(context.events);
        setUsers(context.users);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const loadQueue = useCallback(async () => {
    // Wait for the stored session so the first load already knows the operator for "assigned to me".
    if (!session) return;
    const query = privacyQueueQuery(filters, page, operatorId);
    if (!query) {
      setRequests([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    const next = await repository.queue(query);
    setRequests(next.items);
    setTotal(next.total);
    setHasMore(next.hasMore);
  }, [filters, operatorId, page, repository, session]);

  const loadLegalHolds = useCallback(async () => {
    if (!isPmcmAdmin) return;
    setLegalHolds(await repository.loadLegalHolds(scopeEventId));
  }, [isPmcmAdmin, repository, scopeEventId]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([loadQueue(), loadLegalHolds()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load privacy requests");
    } finally {
      setBusy(false);
    }
  }, [loadLegalHolds, loadQueue]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateFilters = useCallback((patch: Partial<PrivacyConsoleFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }, []);

  /** Runs one command, then reloads the queue and legal holds so the operator sees the new state. */
  const runCommand = useCallback(async (message: string, command: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await command();
      await Promise.all([loadQueue(), loadLegalHolds()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : message);
    } finally {
      setBusy(false);
    }
  }, [loadLegalHolds, loadQueue]);

  const logPrivacyRequest = useCallback(() => runCommand("Unable to log privacy request", async () => {
    await repository.createRequest({
      ...privacyForm,
      eventId: scopeEventId !== "all" ? scopeEventId : undefined,
    });
    setPrivacyForm((current) => ({ ...current, subjectEmail: "", subjectName: "", requestNotes: "" }));
  }), [privacyForm, repository, runCommand, scopeEventId]);

  const assignRequest = useCallback((requestId: string, assignedTo: string | null) =>
    runCommand("Unable to update the privacy request owner", () => repository.assignRequest(requestId, { assignedTo })),
  [repository, runCommand]);

  const reviewPrivacyRequest = useCallback((requestId: string, status: ReviewPrivacyRequestInput["status"]) =>
    runCommand("Unable to review privacy request", () => repository.reviewRequest(requestId, {
      status,
      reviewReason: status === "approved" ? "Validated by PMCM privacy review." : "Rejected by PMCM privacy review.",
    })),
  [repository, runCommand]);

  const executePrivacyRequest = useCallback((requestId: string, draft?: PrivacyCorrectionDraft) => {
    const correction = draft ? parsePrivacyCorrectionDraft(draft) : null;
    if (correction && !correction.ok) {
      setError(correction.message);
      return Promise.resolve();
    }
    return runCommand("Unable to execute privacy request", async () => {
      const result = await repository.executeRequest(
        requestId,
        "Executed from PMCM privacy console.",
        correction?.ok ? correction.patch : undefined,
      );
      if (result.export) downloadPrivacyExportBundle(result.export);
    });
  }, [repository, runCommand]);

  const placePrivacyLegalHold = useCallback(() => {
    const eventScope = legalHoldForm.eventScope === "event";
    if (eventScope && scopeEventId === "all") {
      setError("Select an event before placing an event-limited hold");
      return Promise.resolve();
    }
    const parsed = createPrivacyLegalHoldSchema.safeParse({
      subjectType: legalHoldForm.subjectType,
      subjectEmail: legalHoldForm.subjectEmail,
      subjectName: legalHoldForm.subjectName,
      reason: legalHoldForm.reason,
      ...(eventScope ? { eventId: scopeEventId } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid legal hold scope and reason");
      return Promise.resolve();
    }
    return runCommand("Unable to place legal hold", async () => {
      await repository.createLegalHold(parsed.data);
      setLegalHoldForm(initialLegalHoldForm);
    });
  }, [legalHoldForm, repository, runCommand, scopeEventId]);

  const setLegalHoldReleaseReason = useCallback((holdId: string, reason: string) => {
    setLegalHoldReleaseReasons((current) => ({ ...current, [holdId]: reason }));
  }, []);

  const releasePrivacyLegalHold = useCallback((holdId: string) => {
    const reason = legalHoldReleaseReasons[holdId]?.trim();
    if (!reason) {
      setError("Enter a reason before releasing this legal hold");
      return Promise.resolve();
    }
    return runCommand("Unable to release legal hold", async () => {
      await repository.releaseLegalHold(holdId, { reason });
      setLegalHoldReleaseReasons((current) => ({ ...current, [holdId]: "" }));
    });
  }, [legalHoldReleaseReasons, repository, runCommand]);

  return {
    session,
    events,
    users,
    now,
    isPmcmAdmin,
    operatorId,
    filters,
    updateFilters,
    page,
    setPage,
    hasMore,
    total,
    pageCount: Math.max(1, Math.ceil(total / PRIVACY_CONSOLE_PAGE_SIZE)),
    requests,
    legalHolds,
    privacyForm,
    setPrivacyForm,
    legalHoldForm,
    setLegalHoldForm,
    legalHoldReleaseReasons,
    setLegalHoldReleaseReason,
    busy,
    error,
    refresh,
    logPrivacyRequest,
    assignRequest,
    reviewPrivacyRequest,
    executePrivacyRequest,
    placePrivacyLegalHold,
    releasePrivacyLegalHold,
  };
}

export type PrivacyConsoleViewModel = ReturnType<typeof usePrivacyConsoleViewModel>;
