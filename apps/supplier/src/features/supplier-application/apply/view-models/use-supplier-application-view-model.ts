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
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    supplierApplicationRepository
      .listCategories()
      .then((cats) => {
        setCategories(cats);
        setCategoriesError(cats.length === 0 ? "No service categories available" : null);
      })
      .catch((err: unknown) => {
        setCategoriesError(err instanceof Error ? err.message : "Unable to load service categories");
      })
      .finally(() => setCategoriesLoading(false));
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
      const application = await submitSupplierApplication(form);
      if (!application.id?.trim()) {
        throw new Error("Application submitted but no reference was returned. Please contact PMCM.");
      }
      setApplicationId(application.id.trim());
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
    setApplicationId(null);
    setError(null);
  }

  function resolveCategoryName(categoryId: string): string | undefined {
    return categories.find((c) => c.id === categoryId)?.name;
  }

  return {
    form,
    currentStep,
    status,
    submitted,
    applicationId,
    busy,
    error,
    categories,
    categoriesError,
    categoriesLoading,
    update,
    canContinue,
    nextStep,
    previousStep,
    submit,
    resetSubmitted,
    resolveCategoryName,
  };
}
