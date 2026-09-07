"use client";

import { useRef, useState } from "react";

import { buildPublicInquiryLink, type PrismInquiry } from "@prism/types";
import {
  declineReasons,
  initialLogForm,
  inquiryMatchesIntakeFilters,
  toLogInquiryInput,
  type LogInquiryOnBehalfInput,
} from "../model/inquiry-intake-rules";
import {
  InquiryDeclineDialog,
  InquiryDetailDrawer,
  InquiryIntakeFilters,
  InquiryIntakeHeader,
  InquiryIntakeList,
  InquiryLogOnBehalfForm,
} from "./inquiry-intake-sections";

export type { LogInquiryOnBehalfInput };

export function InquiryIntakeLog({
  inquiries,
  onAccept,
  onPend,
  onDecline,
  onLogOnBehalf,
  busy,
}: {
  inquiries: PrismInquiry[];
  onAccept: (inquiry: PrismInquiry) => Promise<void>;
  onPend: (inquiry: PrismInquiry) => Promise<void>;
  onDecline: (inquiry: PrismInquiry, reason: string) => Promise<void>;
  onLogOnBehalf: (input: LogInquiryOnBehalfInput) => Promise<void>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [clientType, setClientType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [opened, setOpened] = useState<PrismInquiry | null>(null);
  const [declining, setDeclining] = useState<PrismInquiry | null>(null);
  const [declineReason, setDeclineReason] = useState(declineReasons[0]);
  const [loggingOnBehalf, setLoggingOnBehalf] = useState(false);
  const [logForm, setLogForm] = useState(initialLogForm);
  const [logPhase, setLogPhase] = useState<"idle" | "submitting" | "error">("idle");
  const [logError, setLogError] = useState<string | null>(null);
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
  const todayIso = new Date().toISOString().slice(0, 10);
  const logFormFirstFieldRef = useRef<HTMLInputElement>(null);

  const unreviewedCount = inquiries.filter((inquiry) => inquiry.status === "new").length;
  const clientTypes = Array.from(new Set(inquiries.map((inquiry) => inquiry.clientType).filter(Boolean))).sort();
  const filtered = inquiries
    .filter((inquiry) => inquiryMatchesIntakeFilters(inquiry, { query, status, source, clientType, dateRange }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  async function copyInquiryLink() {
    const origin = process.env.NEXT_PUBLIC_CLIENT_ORIGIN ?? "http://localhost:3001";
    try {
      await navigator.clipboard.writeText(buildPublicInquiryLink(origin));
      setCopyLinkState("copied");
      window.setTimeout(() => setCopyLinkState("idle"), 2000);
    } catch {
      setCopyLinkState("error");
    }
  }

  async function confirmDecline() {
    if (!declining) return;
    await onDecline(declining, declineReason);
    setDeclining(null);
    setDeclineReason(declineReasons[0]);
  }

  function closeLogForm() {
    setLoggingOnBehalf(false);
    setLogForm(initialLogForm);
    setLogPhase("idle");
    setLogError(null);
  }

  async function submitLogOnBehalf() {
    setLogPhase("submitting");
    setLogError(null);
    try {
      await onLogOnBehalf(toLogInquiryInput(logForm));
      closeLogForm();
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to log inquiry");
      setLogPhase("error");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <InquiryIntakeHeader
        unreviewedCount={unreviewedCount}
        onLog={() => setLoggingOnBehalf(true)}
        onCopyInquiryLink={() => void copyInquiryLink()}
        copyLinkState={copyLinkState}
      />
      <InquiryIntakeFilters
        query={query}
        status={status}
        source={source}
        clientType={clientType}
        dateRange={dateRange}
        clientTypes={clientTypes}
        onQuery={setQuery}
        onStatus={setStatus}
        onSource={setSource}
        onClientType={setClientType}
        onDateRange={setDateRange}
      />
      <InquiryIntakeList inquiries={filtered} onOpen={setOpened} />
      {opened && (
        <InquiryDetailDrawer
          inquiry={opened}
          busy={busy}
          onClose={() => setOpened(null)}
          onAccept={() => onAccept(opened)}
          onPend={() => onPend(opened)}
          onDecline={() => setDeclining(opened)}
        />
      )}
      {declining && (
        <InquiryDeclineDialog
          clientName={declining.clientName}
          declineReason={declineReason}
          busy={busy}
          onReason={setDeclineReason}
          onCancel={() => setDeclining(null)}
          onConfirm={confirmDecline}
        />
      )}
      {loggingOnBehalf && (
        <InquiryLogOnBehalfForm
          logForm={logForm}
          setLogForm={setLogForm}
          logPhase={logPhase}
          logError={logError}
          todayIso={todayIso}
          firstFieldRef={logFormFirstFieldRef}
          onClose={closeLogForm}
          onSubmit={submitLogOnBehalf}
        />
      )}
    </div>
  );
}
