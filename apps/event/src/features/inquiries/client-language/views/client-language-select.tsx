"use client";

import { useEffect, useState } from "react";
import { CLIENT_LANGUAGE_LABELS, CLIENT_LANGUAGES, type ClientLanguage, type PrismInquiry } from "@prism/types";
import { clientLanguageRepository } from "../data/client-language-repository";

/** FR-55: the language of this client's automated emails (inquiry received, accepted or declined, conforme reminder). */
export function ClientLanguageSelect({ inquiry }: { inquiry: PrismInquiry }) {
  const [language, setLanguage] = useState<ClientLanguage>(inquiry.preferredLanguage ?? "en");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { setLanguage(inquiry.preferredLanguage ?? "en"); setMessage(null); }, [inquiry.id, inquiry.preferredLanguage]);

  async function choose(next: ClientLanguage) {
    setMessage(null);
    try {
      const saved = await clientLanguageRepository.save(inquiry.id, next);
      setLanguage(saved.preferredLanguage ?? next);
      setMessage("Saved");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save the language.");
    }
  }

  return (
    <label className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-xs">
      <span className="font-semibold text-foreground">Client email language</span>
      <select value={language} onChange={(event) => void choose(event.target.value as ClientLanguage)} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
        {CLIENT_LANGUAGES.map((option) => <option key={option} value={option}>{CLIENT_LANGUAGE_LABELS[option]}</option>)}
      </select>
      {message ? <span role="status" className="text-muted-foreground">{message}</span> : null}
    </label>
  );
}
