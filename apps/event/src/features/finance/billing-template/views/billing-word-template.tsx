"use client";

import { useState } from "react";
import type { PrismBillingStatement } from "@prism/types";
import { readDocxText } from "@/features/conforme/signing/model/docx-template-text";
import { fillBillingTemplate } from "../model/billing-template-fill";

const FIELDS = ["statementNumber", "clientName", "clientContact", "eventName", "eventDate", "totalAmount", "lineItems", "paymentSchedule", "paymentMethods"];

/** FR-67: PMCM fills its own Word billing statement template from the issued statement, reviews it, then copies or downloads it. */
export function BillingWordTemplate({ statement }: { statement: PrismBillingStatement | undefined }) {
  const [filled, setFilled] = useState<{ fileName: string; text: string; unknown: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!statement) return null;

  async function choose(file: File | undefined) {
    setError(null);
    if (!file || !statement) { setFilled(null); return; }
    try {
      const result = fillBillingTemplate(await readDocxText(await file.arrayBuffer()), statement);
      setFilled({ fileName: file.name, ...result });
    } catch (caught) {
      setFilled(null);
      setError(caught instanceof Error ? caught.message : "Unable to read the Word template.");
    }
  }

  function download() {
    if (!filled) return;
    const url = URL.createObjectURL(new Blob([filled.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${statement?.number ?? "billing-statement"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Fill your Word billing template</h3>
      <p className="mt-1 text-xs text-muted-foreground">Fields: {FIELDS.map((field) => `{{${field}}}`).join(", ")}. The issued statement and its PDF stay the record; this prepares your own template from it.</p>
      <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void choose(event.currentTarget.files?.[0])} className="mt-2 block text-xs" aria-label="Word billing template" />
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      {filled ? (
        <div className="mt-3 space-y-2">
          {filled.unknown.length ? <p role="status" className="text-xs text-destructive">Not filled: {filled.unknown.map((name) => `{{${name}}}`).join(", ")}</p> : null}
          <textarea readOnly value={filled.text} rows={10} className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" aria-label="Filled billing template" />
          <div className="flex gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText(filled.text)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Copy</button>
            <button type="button" onClick={download} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Download</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
