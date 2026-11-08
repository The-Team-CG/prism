"use client";

import { useEffect, useState } from "react";
import { editPublicInquirySchema, parseContract, type PrismPublicInquiryEdit } from "@prism/types";
import { inquiryRepository } from "../../submit/data/inquiry-repository";

type EditForm = { eventName: string; eventType: string; eventDate: string; message: string; setupNotes: string };

/** FR-50: the submitter changes their inquiry through the emailed link, for 24 hours or until PMCM reviews it. */
export function useInquiryEditViewModel(token: string) {
  const [inquiry, setInquiry] = useState<PrismPublicInquiryEdit | null>(null);
  const [form, setForm] = useState<EditForm>({ eventName: "", eventType: "", eventDate: "", message: "", setupNotes: "" });
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "closed">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void inquiryRepository.getEdit(token).then((loaded) => {
      setInquiry(loaded);
      setForm({ eventName: loaded.eventName, eventType: loaded.eventType, eventDate: loaded.eventDate, message: loaded.message, setupNotes: loaded.setupNotes ?? "" });
      setStatus("ready");
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "This edit link is not valid.");
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

  return { inquiry, form, setField: (key: keyof EditForm, value: string) => setForm((current) => ({ ...current, [key]: value })), status, error, save };
}
