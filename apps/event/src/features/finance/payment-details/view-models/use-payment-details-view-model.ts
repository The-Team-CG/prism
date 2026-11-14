"use client";

import { useEffect, useState } from "react";
import { PrismApiError } from "@prism/api-client";
import { useInvalidate, useResource } from "@prism/portal-query";
import { PAYMENT_METHODS_MAX, PAYMENT_QR_CONTENT_TYPES, PAYMENT_QR_MAX_BYTES, type PaymentMethod, type PaymentMethodKind } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { financePaymentDetails, paymentDetailsCommands } from "../data/payment-details-repository";
import { changedAccountNumbers, isDirty, moveMethod, newMethod, removeMethod, saveProblem, setField, type MethodField } from "../model/payment-details-draft";

type Base = { revision: number; methods: PaymentMethod[] };

const QR_TYPES: readonly string[] = PAYMENT_QR_CONTENT_TYPES;

/** Warns before the tab closes while there are edits that were not saved. */
function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/**
 * PMCM's payment details as an edit: the list loaded at some revision, the changes on top of it, and the save that must
 * still be on that revision. Saving, QR upload and "someone else changed it" are handled here.
 */
export function usePaymentDetailsViewModel() {
  const invalidate = useInvalidate();
  const loaded = useResource(financePaymentDetails, "pmcm");
  const [base, setBase] = useState<Base | null>(null);
  const [draft, setDraft] = useState<PaymentMethod[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmNumbers, setConfirmNumbers] = useState<string[] | null>(null);

  useEffect(() => {
    if (loaded.data && base === null) {
      setBase({ revision: loaded.data.revision, methods: loaded.data.methods });
      setDraft(loaded.data.methods);
    }
  }, [loaded.data, base]);

  const dirty = base !== null && isDirty(base.methods, draft);
  useUnsavedGuard(dirty);

  function add(kind: PaymentMethodKind) {
    if (draft.length >= PAYMENT_METHODS_MAX) return setError(`You can keep up to ${PAYMENT_METHODS_MAX} payment methods.`);
    const method = newMethod(kind);
    setDraft((current) => [...current, method]);
    setOpenId(method.id);
    setError(null);
  }

  const set = (id: string, field: MethodField, value: string | boolean | null) => setDraft((current) => setField(current, id, field, value));
  const move = (id: string, direction: -1 | 1) => setDraft((current) => moveMethod(current, id, direction));
  const remove = (id: string) => setDraft((current) => removeMethod(current, id));
  const discard = () => {
    if (base) setDraft(base.methods);
    setError(null);
    setOpenId(null);
  };

  async function uploadQr(id: string, file: File) {
    if (!QR_TYPES.includes(file.type)) return toast.error("Choose a PNG or JPEG image.");
    if (file.size > PAYMENT_QR_MAX_BYTES) return toast.error("The QR image must be 1 MB or smaller.");
    setUploadingId(id);
    try {
      const image = await paymentDetailsCommands.uploadQr(file);
      set(id, "qrImageId", image.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The QR image could not be uploaded.");
    } finally {
      setUploadingId(null);
    }
  }

  async function save(confirmed = false) {
    if (!base) return;
    const problem = saveProblem(draft);
    if (problem) return setError(problem);
    const changed = changedAccountNumbers(base.methods, draft);
    if (changed.length > 0 && !confirmed) return setConfirmNumbers(changed);
    setConfirmNumbers(null);
    setBusy(true);
    setError(null);
    try {
      const next = await paymentDetailsCommands.save({ expectedRevision: base.revision, methods: draft });
      setBase({ revision: next.revision, methods: next.methods });
      setDraft(next.methods);
      toast.success("Payment details saved. Clients see them now.");
      void invalidate(financePaymentDetails);
    } catch (cause) {
      setConflict(cause instanceof PrismApiError && cause.status === 409);
      setError(cause instanceof Error ? cause.message : "The payment details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  /** Takes what is saved now, dropping the edits, after someone else saved first. */
  async function reload() {
    const fresh = await paymentDetailsCommands.read();
    setBase({ revision: fresh.revision, methods: fresh.methods });
    setDraft(fresh.methods);
    setConflict(false);
    setError(null);
    void invalidate(financePaymentDetails);
  }

  return {
    loadError: loaded.status === "error" && !loaded.data ? loaded.error.message : null,
    ready: base !== null,
    draft, dirty, openId, setOpenId, busy, uploadingId, error, conflict, confirmNumbers,
    add, set, move, remove, discard, uploadQr, save, reload,
    cancelConfirm: () => setConfirmNumbers(null),
  };
}

export type PaymentDetailsViewModel = ReturnType<typeof usePaymentDetailsViewModel>;
