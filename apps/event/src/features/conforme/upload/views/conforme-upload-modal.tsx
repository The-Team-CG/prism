"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PrismInquiry } from "@prism/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ConformeUploadModalProps {
  inquiry: PrismInquiry;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}

type ModalPhase = "pick" | "uploading" | "success" | "error";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConformeUploadModal({ inquiry, onUpload, onClose }: ConformeUploadModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upload signed conforme"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        {phase === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="size-10 text-(--prism-success)" />
            <p className="text-sm font-bold text-foreground">Conforme uploaded</p>
            <p className="text-xs text-muted-foreground">
              {inquiry.clientName} — {inquiry.eventName}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Upload signed conforme</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inquiry.clientName} — {inquiry.eventName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={phase === "uploading"}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Select PDF file"
              />
              <button
                ref={selectButtonRef}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={phase === "uploading"}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-(--prism-signal)/40 hover:bg-secondary/50 disabled:opacity-50"
              >
                <FileUp className="size-6 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">
                  {file ? file.name : "Click to select PDF"}
                </span>
                {file ? (
                  <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">PDF only, max 10 MB</span>
                )}
              </button>
            </div>

            {(validationError || apiError) && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{validationError || apiError}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-lg font-bold"
                onClick={onClose}
                disabled={phase === "uploading"}
              >
                Cancel
              </Button>
              <Button
                className="rounded-lg font-bold"
                disabled={!file || !!validationError || phase === "uploading"}
                onClick={handleSubmit}
              >
                {phase === "uploading" ? "Uploading…" : "Upload conforme"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
