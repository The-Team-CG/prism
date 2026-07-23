"use client";

import { useEffect, useMemo, useState } from "react";
import { supplierApplicationRepository } from "../data/supplier-application-repository";
import {
  isSupplierApplicationStepValid,
  mapSupplierApplicationSubmitError,
  nextSupplierApplicationStep,
  previousSupplierApplicationStep,
} from "../model/supplier-application-rules";
import {
  INITIAL_SUPPLIER_APPLICATION_FORM,
  type SupplierApplicationForm,
  type SupplierApplicationSubmitStatus,
} from "../model/supplier-application-types";
import { submitSupplierApplication } from "../use-cases/submit-supplier-application";

export function useSupplierApplicationViewModel() {
  const [form, setForm] = useState<SupplierApplicationForm>(INITIAL_SUPPLIER_APPLICATION_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<SupplierApplicationSubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supplierApplicationRepository
      .listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const submitted = status === "submitted";
  const busy = status === "loading";

  function update<K extends keyof SupplierApplicationForm>(key: K, value: SupplierApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canContinue(step = currentStep) {
    return isSupplierApplicationStepValid(form, step);
  }

  function nextStep() {
    if (!canContinue()) return;
    setCurrentStep((step) => nextSupplierApplicationStep(step));
  }

  function previousStep() {
    setCurrentStep((step) => previousSupplierApplicationStep(step));
  }

  async function submit() {
    if (!canContinue(3) || busy) return;
    setStatus("loading");
    setError(null);
    try {
      await submitSupplierApplication(form);
      setStatus("submitted");
      setForm(INITIAL_SUPPLIER_APPLICATION_FORM);
      setCurrentStep(0);
    } catch (err) {
      setStatus("error");
      setError(mapSupplierApplicationSubmitError(err));
    }
  }

  function resetSubmitted() {
    setStatus("idle");
    setError(null);
  }

  function resolveCategoryName(categoryId: string): string | undefined {
    return categories.find((c) => c.id === categoryId)?.name;
  }

  return {
    form,
    currentStep,
    submitted,
    busy,
    error,
    categories,
    update,
    canContinue,
    nextStep,
    previousStep,
    submit,
    resetSubmitted,
    resolveCategoryName,
  };
}
