"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PrismConformeExecution, PrismInquiry } from "@prism/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ConformeUploadModalProps {
  inquiry: PrismInquiry;
  onUpload: (file: File) => Promise<void>;
  onPrepareDigital: () => Promise<PrismConformeExecution>;
  onRefreshDigital: () => Promise<PrismConformeExecution>;
  onSignDigital: (execution: PrismConformeExecution) => Promise<PrismConformeExecution>;
  onClose: () => void;
}

type ModalPhase = "pick" | "uploading" | "success" | "error";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

export function ConformeUploadModal({ inquiry, onUpload, onPrepareDigital, onRefreshDigital, onSignDigital, onClose }: ConformeUploadModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [digitalExecution, setDigitalExecution] = useState<PrismConformeExecution | null>(null);
  const [digitalBusy, setDigitalBusy] = useState(false);
  const [digitalConsent, setDigitalConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectButtonRef = useRef<HTMLButtonElement>(null);
  const refreshDigitalRef = useRef(onRefreshDigital);
  refreshDigitalRef.current = onRefreshDigital;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "uploading" && phase !== "success") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, phase]);

  useEffect(() => {
    selectButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    setDigitalBusy(true);
    setApiError(null);
    setDigitalExecution(null);
    setDigitalConsent(false);
    refreshDigitalRef.current()
      .then((execution) => { if (active) setDigitalExecution(execution); })
      .catch((error: unknown) => {
        if (!active || isNotFoundError(error)) return;
        setApiError(error instanceof Error ? error.message : "Unable to load the current in-app conforme.");
      })
      .finally(() => { if (active) setDigitalBusy(false); });
    return () => { active = false; };
  }, [inquiry.id]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setApiError(null);

    const isPdf = selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setValidationError("Only PDF files are accepted.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setValidationError("File must be smaller than 10 MB.");
      setFile(null);
      return;
    }

    setValidationError(null);
    setFile(selected);
    if (phase === "error") setPhase("pick");
  }, [phase]);

  async function handleSubmit() {
    if (!file) return;
    setPhase("uploading");
    setApiError(null);
    try {
      await onUpload(file);
      setPhase("success");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  async function prepareDigital() {
    setDigitalBusy(true);
    setApiError(null);
    try { setDigitalExecution(await onPrepareDigital()); }
    catch (err) { setApiError(err instanceof Error ? err.message : "Unable to prepare the in-app conforme."); }
    finally { setDigitalBusy(false); }
  }

  async function refreshDigital() {
    setDigitalBusy(true);
    setApiError(null);
    try { setDigitalExecution(await onRefreshDigital()); }
    catch (err) { setApiError(err instanceof Error ? err.message : "Unable to refresh the conforme status."); }
    finally { setDigitalBusy(false); }
  }

  async function signDigital() {
    if (!digitalExecution || !digitalConsent) return;
    setDigitalBusy(true);
    setApiError(null);
    try { setDigitalExecution(await onSignDigital(digitalExecution)); setDigitalConsent(false); }
    catch (err) { setApiError(err instanceof Error ? err.message : "Unable to record the countersignature."); }
    finally { setDigitalBusy(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Upload signed conforme">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
      <DigitalExecutionPanel execution={digitalExecution} busy={digitalBusy} consent={digitalConsent} onConsent={setDigitalConsent} onRefresh={refreshDigital} onPrepare={prepareDigital} onSign={signDigital} />
      {phase === "success" ? <UploadSuccess inquiry={inquiry} /> : <ConformeUploadForm inquiry={inquiry} phase={phase} file={file} validationError={validationError} apiError={apiError} digitalBusy={digitalBusy} fileInputRef={fileInputRef} selectButtonRef={selectButtonRef} onClose={onClose} onFileChange={handleFileChange} onPrepareDigital={prepareDigital} onSubmit={handleSubmit} />}
    </div>
  </div>;
}

function DigitalExecutionPanel({ execution, busy, consent, onConsent, onRefresh, onPrepare, onSign }: { execution: PrismConformeExecution | null; busy: boolean; consent: boolean; onConsent: (value: boolean) => void; onRefresh: () => Promise<void>; onPrepare: () => Promise<void>; onSign: () => Promise<void> }) {
  if (!execution) return null;
  return <section className="mb-5 space-y-3 border-b border-border pb-5"><h3 className="text-base font-bold text-foreground">In-app conforme · version {execution.templateVersion}</h3><p className="text-sm text-muted-foreground">The client reviews this immutable document at <span className="font-semibold">/conforme</span>. A version with a recorded signature cannot be replaced.</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 font-sans text-xs leading-5 text-foreground">{execution.documentContent}</pre><p className="text-xs text-muted-foreground">Status: {execution.status.replaceAll("_", " ")}</p>
    <DigitalExecutionActions execution={execution} busy={busy} onRefresh={onRefresh} onPrepare={onPrepare} />
    <DigitalExecutionSignoff execution={execution} busy={busy} consent={consent} onConsent={onConsent} onSign={onSign} />
    {execution.status === "completed" ? <p className="text-sm text-muted-foreground">Both acknowledgments are recorded; the client workspace is active.</p> : null}
  </section>;
}

function DigitalExecutionActions({ execution, busy, onRefresh, onPrepare }: { execution: PrismConformeExecution; busy: boolean; onRefresh: () => Promise<void>; onPrepare: () => Promise<void> }) {
  const canRefresh = execution.status === "awaiting_client" || execution.status === "awaiting_pmcm";
  return <>
    {canRefresh ? <button type="button" disabled={busy} onClick={() => void onRefresh()} className="text-sm font-semibold text-primary hover:underline">{busy ? "Refreshing…" : "Refresh signing status"}</button> : null}
    {execution.status === "awaiting_client" && execution.signatures.length === 0 ? <button type="button" disabled={busy} onClick={() => void onPrepare()} className="block text-sm font-semibold text-primary hover:underline">{busy ? "Preparing…" : "Prepare replacement version"}</button> : null}
  </>;
}

function DigitalExecutionSignoff({ execution, busy, consent, onConsent, onSign }: { execution: PrismConformeExecution; busy: boolean; consent: boolean; onConsent: (value: boolean) => void; onSign: () => Promise<void> }) {
  if (execution.status !== "awaiting_pmcm") return null;
  return <div className="space-y-3 rounded-lg bg-muted/50 p-3"><p className="text-sm leading-5 text-foreground">The client has acknowledged this version. Review the document and countersign to activate the client workspace.</p><label className="flex items-start gap-2 text-xs leading-5 text-foreground"><input type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)} className="mt-1 size-4 accent-primary" />I reviewed this exact version and approve the in-app record.</label><Button type="button" disabled={busy || !consent} onClick={() => void onSign()} className="rounded-lg font-bold">{busy ? "Recording…" : "Countersign and activate"}</Button></div>;
}

function UploadSuccess({ inquiry }: { inquiry: PrismInquiry }) {
  return <div className="flex flex-col items-center gap-3 py-4"><CheckCircle2 className="size-10 text-(--prism-success)" /><p className="text-sm font-bold text-foreground">Conforme uploaded</p><p className="text-xs text-muted-foreground">{inquiry.clientName} — {inquiry.eventName}</p></div>;
}

function ConformeUploadForm({ inquiry, phase, file, validationError, apiError, digitalBusy, fileInputRef, selectButtonRef, onClose, onFileChange, onPrepareDigital, onSubmit }: { inquiry: PrismInquiry; phase: ModalPhase; file: File | null; validationError: string | null; apiError: string | null; digitalBusy: boolean; fileInputRef: React.RefObject<HTMLInputElement | null>; selectButtonRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void; onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onPrepareDigital: () => Promise<void>; onSubmit: () => Promise<void> }) {
  const busy = phase === "uploading";
  return <>
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold text-foreground">Upload signed conforme</h3><p className="mt-1 text-sm text-muted-foreground">{inquiry.clientName} — {inquiry.eventName}</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50" aria-label="Close"><X className="size-4" /></button></div>
    <FileSelection file={file} busy={busy} inputRef={fileInputRef} buttonRef={selectButtonRef} onFileChange={onFileChange} />
    <section className="mt-4 space-y-2 rounded-lg border border-border bg-background p-4"><h4 className="text-sm font-bold text-foreground">In-app acknowledgment</h4><p className="text-xs leading-5 text-muted-foreground">Prepare an immutable, prefilled conforme for client review. The workspace opens after both acknowledgments are recorded.</p><Button type="button" variant="outline" disabled={digitalBusy} onClick={() => void onPrepareDigital()} className="rounded-lg font-bold">{digitalBusy ? "Preparing…" : "Prepare in-app conforme"}</Button></section>
    {(validationError || apiError) ? <UploadError message={validationError || apiError || "Upload failed"} /> : null}
    <UploadActions file={file} validationError={validationError} busy={busy} onClose={onClose} onSubmit={onSubmit} />
  </>;
}

function FileSelection({ file, busy, inputRef, buttonRef, onFileChange }: { file: File | null; busy: boolean; inputRef: React.RefObject<HTMLInputElement | null>; buttonRef: React.RefObject<HTMLButtonElement | null>; onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="mt-4"><input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={onFileChange} className="hidden" aria-label="Select PDF file" /><button ref={buttonRef} type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-(--prism-signal)/40 hover:bg-secondary/50 disabled:opacity-50"><FileUp className="size-6 text-muted-foreground" /><span className="text-sm font-bold text-foreground">{file ? file.name : "Click to select PDF"}</span>{file ? <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span> : <span className="text-xs text-muted-foreground">PDF only, max 10 MB</span>}</button></div>;
}

function UploadActions({ file, validationError, busy, onClose, onSubmit }: { file: File | null; validationError: string | null; busy: boolean; onClose: () => void; onSubmit: () => Promise<void> }) {
  return <div className="mt-5 flex justify-end gap-2"><Button variant="outline" className="rounded-lg font-bold" onClick={onClose} disabled={busy}>Cancel</Button><Button className="rounded-lg font-bold" disabled={!file || !!validationError || busy} onClick={() => void onSubmit()}>{busy ? "Uploading…" : "Upload conforme"}</Button></div>;
}

function UploadError({ message }: { message: string }) {
  return <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" /><p className="text-xs text-destructive">{message}</p></div>;
}
