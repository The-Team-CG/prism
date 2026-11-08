"use client";

import { useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { clientOwnPrivacyRequestsResource } from "../data/client-privacy-repository";
import type { PrivacyRequestType } from "../model/client-privacy-rules";
import { submitClientPrivacyRequest } from "../use-cases/submit-client-privacy-request";

export function useClientPrivacyRequestsViewModel() {
  const list = useResource(clientOwnPrivacyRequestsResource, undefined);
  const invalidate = useInvalidate();
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitClientPrivacyRequest({ requestType, details });
      setDetails("");
      await invalidate(clientOwnPrivacyRequestsResource);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The privacy request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return {
    requests: list.status === "error" ? [] : list.data ?? [],
    status: list.status === "pending" ? ("loading" as const) : list.status,
    loadError: list.status === "error" ? list.error.message || "Unable to load your privacy requests." : null,
    requestType,
    details,
    busy,
    error,
    setRequestType,
    setDetails,
    submit,
  };
}

export type ClientPrivacyRequestsViewModel = ReturnType<typeof useClientPrivacyRequestsViewModel>;
