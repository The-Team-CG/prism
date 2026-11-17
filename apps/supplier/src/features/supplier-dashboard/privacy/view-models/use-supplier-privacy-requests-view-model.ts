"use client";

import { useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { PrivacyRequestChoice } from "@prism/ui/privacy-requests";
import { supplierOwnPrivacyRequestsResource, supplierPrivacyNoticeResource, supplierPrivacyRequestRepository } from "../data/supplier-privacy-repository";
import { submitSupplierPrivacyRequest } from "../use-cases/submit-supplier-privacy-request";

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback);

/** The supplier's privacy page: their requests, a new request, withdrawing one PMCM has not started, and the notice they accepted. */
export function useSupplierPrivacyRequestsViewModel() {
  const list = useResource(supplierOwnPrivacyRequestsResource, undefined);
  const notice = useResource(supplierPrivacyNoticeResource, undefined);
  const invalidate = useInvalidate();
  const [requestType, setRequestType] = useState<PrivacyRequestChoice>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitSupplierPrivacyRequest({ requestType, details });
      setDetails("");
      await invalidate(supplierOwnPrivacyRequestsResource);
    } catch (cause: unknown) {
      setError(messageOf(cause, "The privacy request could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(requestId: string) {
    setCancellingId(requestId);
    setCancelError(null);
    try {
      await supplierPrivacyRequestRepository.cancel(requestId);
      await invalidate(supplierOwnPrivacyRequestsResource);
    } catch (cause: unknown) {
      setCancelError(messageOf(cause, "The request could not be cancelled."));
    } finally {
      setCancellingId(null);
    }
  }

  return {
    requests: list.status === "error" ? [] : list.data ?? [],
    status: list.status === "pending" ? ("loading" as const) : list.status,
    loadError: list.status === "error" ? list.error.message || "Unable to load your privacy requests." : null,
    notice: notice.status === "ready" ? notice.data : null,
    requestType,
    details,
    busy,
    error,
    setRequestType,
    setDetails,
    submit,
    cancellingId,
    cancelError,
    cancel,
  };
}

export type SupplierPrivacyRequestsViewModel = ReturnType<typeof useSupplierPrivacyRequestsViewModel>;
