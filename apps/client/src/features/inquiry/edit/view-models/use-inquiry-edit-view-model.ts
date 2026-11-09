"use client";

import { useEffect, useState } from "react";
import { editPublicInquirySchema, parseContract, type PrismPublicInquiryEdit } from "@prism/types";
import { PrismApiError } from "@prism/api-client";
import { inquiryRepository } from "../../submit/data/inquiry-repository";

type EditForm = { eventName: string; eventType: string; eventDate: string; message: string; setupNotes: string };

export type InquiryEditClosedReason = "invalid" | "unavailable";

/** The message to show for a failed load: a bad or expired link is not the same problem as a server outage. */
export function inquiryEditLoadFailure(caught: unknown): InquiryEditClosedReason {
  return caught instanceof PrismApiError && caught.status >= 500 ? "unavailable" : "invalid";
}

/** FR-50: the submitter changes their inquiry through the emailed link, for 24 hours or until PMCM reviews it. */
export function useInquiryEditViewModel(token: string) {
  const [inquiry, setInquiry] = useState<PrismPublicInquiryEdit | null>(null);
  const [form, setForm] = useState<EditForm>({ eventName: "", eventType: "", eventDate: "", message: "", setupNotes: "" });
  // Without a token there is nothing to load, so the page is closed from the start rather than asking the API for "".
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "closed">(token ? "loading" : "closed");
  const [closedReason, setClosedReason] = useState<InquiryEditClosedReason>("invalid");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void inquiryRepository.getEdit(token).then((loaded) => {
      setInquiry(loaded);
      setForm({ eventName: loaded.eventName, eventType: loaded.eventType, eventDate: loaded.eventDate, message: loaded.message, setupNotes: loaded.setupNotes ?? "" });
      setStatus("ready");
    }).catch((caught: unknown) => {
      setClosedReason(inquiryEditLoadFailure(caught));
      setStatus("closed");
    });
  }, [token]);

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      setInquiry(await inquiryRepository.saveEdit(token, parseContract(editPublicInquirySchema, form, "Inquiry changes")));
      setStatus("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your changes.");
      setStatus("ready");
    }
  }

  return {
    inquiry,
    form,
    setField: (key: keyof EditForm, value: string) => setForm((current) => ({ ...current, [key]: value })),
    status,
    closedReason,
    error,
    save,
  };
}
