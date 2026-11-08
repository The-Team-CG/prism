"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseContract, saveInquiryDraftSchema } from "@prism/types";
import { inquiryRepository } from "../data/inquiry-repository";
import { clearLocalDraft, draftPayload, formFromPayload, hasDraftContent, newDraftToken, readLocalDraft, saveLocalDraft, serverDraftAllowed } from "../model/inquiry-draft";
import { toast } from "sonner";
import {
  applyInquiryPrefill,
  isInquiryStepValid,
  mapInquirySubmitError,
  missingInquiryFields,
  nextInquiryStep,
  previousInquiryStep,
  inquiryMinDate,
} from "../model/inquiry-submit-rules";
import {
  INITIAL_INQUIRY_FORM,
  type InquiryForm,
  type InquirySubmitStatus,
} from "../model/inquiry-submit-types";
import { submitInquiry } from "../use-cases/submit-inquiry";

export function useInquirySubmitViewModel() {
  const [form, setForm] = useState<InquiryForm>(INITIAL_INQUIRY_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<InquirySubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [receipt, setReceipt] = useState<{ editToken?: string; editableUntil?: string } | null>(null);
  const draftToken = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resume = params.get("draft");
    const local = readLocalDraft();
    draftToken.current = resume ?? local?.token ?? newDraftToken();
    if (resume) {
      void inquiryRepository.getDraft(resume).then((draft) => setForm(formFromPayload(draft.payload))).catch(() => undefined);
    } else if (local) {
      setForm(local.form);
    } else {
      setForm((current) => applyInquiryPrefill(current, params));
    }
  }, []);

  // FR-50: keep the draft in this browser as the visitor types, and on the server once they accept the privacy notice.
  useEffect(() => {
    const token = draftToken.current;
    if (!token || status === "submitted" || !hasDraftContent(form)) return;
    const timer = setTimeout(() => {
      saveLocalDraft({ token, form });
      if (!serverDraftAllowed(form)) return;
      const input = parseContract(saveInquiryDraftSchema, { privacyConsentAccepted: true, email: form.email.trim(), payload: draftPayload(form) }, "Inquiry draft");
      void inquiryRepository.saveDraft(token, input).catch(() => undefined);
    }, 2_000);
    return () => clearTimeout(timer);
  }, [form, status]);

  const minDate = useMemo(() => inquiryMinDate(), []);
  const submitted = status === "submitted";
  const busy = status === "loading";

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canContinue(step = currentStep) {
    return isInquiryStepValid(form, step);
  }

  function nextStep() {
    if (!canContinue()) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setCurrentStep((step) => nextInquiryStep(step));
  }

  function previousStep() {
    setAttempted(false);
    setCurrentStep((step) => previousInquiryStep(step));
  }

  /** Jump back to an earlier step; never forward past an unanswered one. */
  function goToStep(step: number) {
    setCurrentStep((current) => Math.min(Math.max(step, 0), current));
  }

  async function submit() {
    if (!canContinue(3)) {
      setAttempted(true);
      return;
    }
    if (busy) return;
    setStatus("loading");
    setError(null);
    try {
      const created = await submitInquiry(form);
      setReceipt({ editToken: created.editToken, editableUntil: created.editableUntil });
      const token = draftToken.current;
      clearLocalDraft();
      if (token) void inquiryRepository.discardDraft(token).catch(() => undefined);
      draftToken.current = newDraftToken();
      setStatus("submitted");
      setForm(INITIAL_INQUIRY_FORM);
      setCurrentStep(0);
      toast.success("Inquiry received", {
        description: "PMCM will review the details and contact you with next steps.",
      });
    } catch (err) {
      setStatus("error");
      setError(mapInquirySubmitError(err));
    }
  }

  function resetSubmitted() {
    setStatus("idle");
    setError(null);
  }

  const missing = attempted ? missingInquiryFields(form, currentStep) : [];

  return {
    receipt,
    form,
    missing,
    currentStep,
    status,
    submitted,
    busy,
    error,
    minDate,
    update,
    canContinue,
    nextStep,
    previousStep,
    goToStep,
    submit,
    resetSubmitted,
  };
}
