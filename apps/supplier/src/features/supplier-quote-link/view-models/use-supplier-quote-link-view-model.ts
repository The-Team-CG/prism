"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismSupplierQuoteRequestTokenDetail } from "@prism/types";
import { loadSupplierQuoteLink } from "../use-cases/load-supplier-quote-link";
import { saveSupplierQuote } from "../use-cases/save-supplier-quote";

type QuoteForm = { amount: string; inclusions: string; paymentTerms: string; notes: string };
const emptyForm: QuoteForm = { amount: "", inclusions: "", paymentTerms: "", notes: "" };

export function useSupplierQuoteLinkViewModel(token: string) {
  const [detail, setDetail] = useState<PrismSupplierQuoteRequestTokenDetail | null>(null);
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadSupplierQuoteLink(token).then((value) => {
      if (!active) return;
      setDetail(value);
      if (value.quote) setForm({ amount: String(value.quote.amount), inclusions: value.quote.inclusions.join("\n"), paymentTerms: value.quote.paymentTerms, notes: value.quote.notes });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "This quote link is unavailable.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const update = useCallback((patch: Partial<QuoteForm>) => setForm((current) => ({ ...current, ...patch })), []);
  const submit = useCallback(async () => {
    if (!detail) return false;
    setBusy(true);
    setError(null);
    try {
      await saveSupplierQuote(token, Boolean(detail.quote), {
        amount: Number(form.amount),
        inclusions: form.inclusions.split("\n").map((item) => item.trim()).filter(Boolean),
        paymentTerms: form.paymentTerms,
        notes: form.notes,
      });
      setComplete(true);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit this quote.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [detail, form, token]);

  return { detail, form, loading, busy, error, complete, update, submit };
}
