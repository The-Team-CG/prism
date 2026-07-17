"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ACCESS_GATE_POINTS,
  INITIAL_ACCESS_REQUEST,
  type AccessRequestDraft,
  type SignUpStatus,
} from "../model/sign-up-types";
import { submitAccessRequest } from "../use-cases/sign-up";

export function useSignUpViewModel() {
  const [draft, setDraft] = useState<AccessRequestDraft>(INITIAL_ACCESS_REQUEST);
  const [status, setStatus] = useState<SignUpStatus>("idle");

  function update<K extends keyof AccessRequestDraft>(key: K, value: AccessRequestDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    const result = submitAccessRequest(draft);
    if (!result.ok) return;
    setStatus("sent");
    toast.success("Access request submitted", {
      description: "PMCM will review and notify you once your inquiry progresses.",
    });
  }

  return {
    draft,
    sent: status === "sent",
    gatePoints: ACCESS_GATE_POINTS,
    update,
    submit,
  };
}
