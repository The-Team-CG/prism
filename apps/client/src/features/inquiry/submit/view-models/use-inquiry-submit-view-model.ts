"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  applyInquiryPrefill,
  isInquiryStepValid,
  mapInquirySubmitError,
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

  useEffect(() => {
    setForm((current) => applyInquiryPrefill(current, new URLSearchParams(window.location.search)));
  }, []);

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
    if (!canContinue()) return;
    setCurrentStep((step) => nextInquiryStep(step));
  }

  function previousStep() {
    setCurrentStep((step) => previousInquiryStep(step));
  }

  async function submit() {
    if (!canContinue(3) || busy) return;
    setStatus("loading");
    setError(null);
    try {
      await submitInquiry(form);
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

  return {
    form,
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
    submit,
    resetSubmitted,
  };
}
