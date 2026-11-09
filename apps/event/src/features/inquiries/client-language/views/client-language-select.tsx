"use client";

import { useEffect, useState } from "react";
import { CLIENT_LANGUAGE_LABELS, CLIENT_LANGUAGES, type ClientLanguage, type PrismInquiry } from "@prism/types";
import { clientLanguageRepository } from "../data/client-language-repository";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

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
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-xs">
      <span className="font-semibold text-foreground">Client email language</span>
      <Select value={language} onValueChange={(value) => { const next = CLIENT_LANGUAGES.find((candidate) => candidate === value); if (next) void choose(next); }}>
        <SelectTrigger aria-label="Client email language" size="sm" className="h-8 w-auto min-w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIENT_LANGUAGES.map((option) => <SelectItem key={option} value={option}>{CLIENT_LANGUAGE_LABELS[option]}</SelectItem>)}
        </SelectContent>
      </Select>
      {message ? <span role="status" className="text-muted-foreground">{message}</span> : null}
    </div>
  );
}
