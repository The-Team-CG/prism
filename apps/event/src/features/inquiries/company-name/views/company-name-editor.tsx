"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { parseContract, updateInquiryCompanyNameSchema, type PrismCompanyNameChange } from "@prism/types";
import { companyNameRepository } from "../data/company-name-repository";

/** FR-44: PMCM corrects a client's company name; every change keeps its reason in a change log. */
export function CompanyNameEditor({ inquiryId, companyName }: { inquiryId: string; companyName: string }) {
  const [name, setName] = useState(companyName);
  const [current, setCurrent] = useState(companyName);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<PrismCompanyNameChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setHistory(await companyNameRepository.history(inquiryId)); } catch { setHistory([]); }
  }, [inquiryId]);
  useEffect(() => { setName(companyName); setCurrent(companyName); void load(); }, [companyName, load]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const change = await companyNameRepository.update(inquiryId, parseContract(updateInquiryCompanyNameSchema, { companyName: name, reason }, "Company name"));
      setCurrent(change.toName);
      setReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the company name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
      <p className="font-semibold text-foreground">Company name</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grow">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" /></label>
        <label className="grow">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Company rebranded" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" /></label>
        <button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !reason.trim() || name.trim() === current.trim()} className="rounded-md border border-border px-3 py-1.5 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Change name"}</button>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {history.length ? (
        <ul className="space-y-1 text-muted-foreground">
          {history.map((item) => <li key={item.id}>{formatPortalDateTime(item.changedAt)} · {item.fromName || "(none)"} → {item.toName} · {item.reason} · {item.changedBy}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
