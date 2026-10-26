"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import {
  deriveWorkspace,
  initialForm,
  mapSupplierWorkspaceError,
  mergeQuoteForms,
  sectionMeta,
} from "../model/supplier-workspace-rules";
import type {
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  QuoteFormState,
  SupplierDashboardSection,
  SupplierWorkspace,
  SupplierWorkspaceStatus,
} from "../model/supplier-workspace-types";
import {
  confirmSupplierAssignment,
  confirmSupplierReadiness,
  acknowledgeSupplierSchedule,
  loadSupplierDashboardSession,
  loadSupplierWorkspace,
  requestSupplierScheduleChange,
  saveSupplierContract,
  submitSupplierCreativeTask,
  signOutSupplier,
  submitOrReviseQuote,
  updateSupplierEventStatus,
  updateSupplierCreativeProgress,
} from "../use-cases/supplier-workspace-actions";
import { supplierWorkflowRepository } from "../data/supplier-workflow-repository";

export function useSupplierWorkspaceViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<PrismAuthenticatedSession | null>(null);
  const [workspace, setWorkspace] = useState<SupplierWorkspace | null>(null);
  const [readinessBoard, setReadinessBoard] = useState<PrismSupplierReadinessBoard | null>(
    null,
  );
  const [workflowWorkspace, setWorkflowWorkspace] = useState<PrismSupplierWorkflowWorkspace | null>(null);
  const [section, setSection] = useState<SupplierDashboardSection>("dashboard");
  const [forms, setForms] = useState<Record<string, QuoteFormState>>({});
  const [readinessNotes, setReadinessNotes] = useState<Record<string, string>>({});
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const contractSubmissionKeys = useRef<Record<string, { fingerprint: string; key: string }>>({});

  useEffect(() => {
    const current = loadSupplierDashboardSession();
    if (!current) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }
    setSession(current);
  }, [router]);

  async function refresh(current = session) {
    if (!current) return;
    setError(null);
    try {
      const next = await loadSupplierWorkspace(current);
      setWorkspace(next.workspace);
      setReadinessBoard(next.readinessBoard);
      setWorkflowWorkspace(next.workflows);
      setForms((existing) => mergeQuoteForms(existing, next.workspace));
    } catch (err) {
      setError(mapSupplierWorkspaceError(err));
    }
  }

  useEffect(() => {
    if (session) void refresh(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match original: refresh when session email changes
  }, [session?.email]);

  const derived = useMemo(
    () => deriveWorkspace(workspace, readinessBoard),
    [workspace, readinessBoard],
  );

  function updateForm(requestId: string, patch: Partial<QuoteFormState>) {
    setForms((cur) => ({
      ...cur,
      [requestId]: { ...(cur[requestId] ?? initialForm()), ...patch },
    }));
  }

  async function submitQuote(
    ev: FormEvent<HTMLFormElement>,
    req: PrismSupplierQuoteRequest,
  ) {
    ev.preventDefault();
    const form = forms[req.id] ?? initialForm();
    const existingQuote = derived.quoteByRequest.get(req.id);
    setBusy(req.id);
    setError(null);
    setNotice(null);
    try {
      const result = await submitOrReviseQuote({
        request: req,
        form,
        existingQuote,
      });
      setNotice(result.notice);
      await refresh();
    } catch (err) {
      setError(mapSupplierWorkspaceError(err, "Unable to submit quote"));
    } finally {
      setBusy(null);
    }
  }

  async function runAction(
    req: PrismSupplierQuoteRequest,
    action: string,
    task: () => Promise<{ notice: string }>,
  ) {
    setBusy(`${req.id}:${action}`);
    setError(null);
    setNotice(null);
    try {
      const result = await task();
      setNotice(result.notice);
      await refresh();
    } catch (err) {
      setError(mapSupplierWorkspaceError(err, "Action failed"));
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await signOutSupplier();
    router.replace("/sign-in");
  }

  const meta =
    session != null ? sectionMeta(section, session, workspace) : null;
  const status: SupplierWorkspaceStatus = error ? "error" : workspace ? "success" : session ? "loading" : "idle";

  return {
    session,
    workspace,
    workflowWorkspace,
    readinessBoard,
    section,
    setSection,
    forms,
    readinessNotes,
    statusNotes,
    error,
    notice,
    busy,
    status,
    derived,
    meta,
    updateForm,
    submitQuote,
    setReadinessNote: (id: string, v: string) =>
      setReadinessNotes((c) => ({ ...c, [id]: v })),
    setStatusNote: (id: string, v: string) =>
      setStatusNotes((c) => ({ ...c, [id]: v })),
    confirmAssignment: (req: PrismSupplierQuoteRequest) =>
      runAction(req, "assignment", () =>
        confirmSupplierAssignment(session!, req),
      ),
    confirmReadiness: (req: PrismSupplierQuoteRequest) =>
      runAction(req, "readiness", () =>
        confirmSupplierReadiness(
          session!,
          req,
          readinessNotes[req.id] ?? req.readinessNotes ?? "",
        ),
      ),
    saveContract: (req: PrismSupplierQuoteRequest, file: File) =>
      runAction(req, "contract", () =>
        saveSupplierContract(
          session!,
          workspace!.supplier,
          req,
          file,
        ),
      ),
    acknowledgeSchedule: (requestId: string, revision: number) =>
      runWorkflowAction(`schedule:${requestId}`, () => acknowledgeSupplierSchedule(session!, requestId, revision)),
    requestScheduleChange: (requestId: string, revision: number, reason: string) =>
      runWorkflowAction(`schedule:${requestId}`, () => requestSupplierScheduleChange(session!, requestId, revision, reason)),
    updateCreativeProgress: (taskId: string, note: string) =>
      runWorkflowAction(`creative:${taskId}`, () => updateSupplierCreativeProgress(session!, taskId, note)),
    submitCreativeTask: (requestId: string, taskId: string, note: string, file?: File) => {
      const request = workspace?.quoteRequests.find((item) => item.id === requestId);
      if (!request || !workspace || !session) return;
      return runWorkflowAction(`creative:${taskId}`, () => submitSupplierCreativeTask(session, workspace.supplier, request, taskId, note, file));
    },
    downloadObject: async (objectId: string) => {
      if (!session) return;
      try {
        const download = await supplierWorkflowRepository.download(session, objectId);
        const url = URL.createObjectURL(download.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = download.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(mapSupplierWorkspaceError(err, "Unable to download file"));
      }
    },
    updateStatus: (req: PrismSupplierQuoteRequest, status: string) =>
      runAction(req, status, () =>
        updateSupplierEventStatus(
          session!,
          req,
          status,
          statusNotes[req.id] ?? req.eventDayNotes ?? "",
        ),
      ),
    refresh: () => refresh(),
    signOut,
    goToSignIn: () => router.replace("/sign-in"),
  };

  async function runWorkflowAction(key: string, task: () => Promise<{ notice: string }>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await task();
      setNotice(result.notice);
      await refresh();
    } catch (err) {
      setError(mapSupplierWorkspaceError(err, "Action failed"));
    } finally {
      setBusy(null);
    }
  }
}
