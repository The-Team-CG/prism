"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Eye,
  Mail,
  MessageSquareText,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { PrismInquiry } from "@prism/types";
import { compactTimestamp, label } from "@/features/pmcm-kit";
import {
  declineReasons,
  inquiryExtraDetailFields,
  inquiryStatusAccent,
  isInquiryLogFormReady,
  logFormChannels,
  logFormClientTypes,
  logFormEventTypes,
  logFormReferralSources,
  type InquiryLogForm,
} from "../model/inquiry-intake-rules";

function DetailField({ label: fieldLabel, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{fieldLabel}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
}

export function InquiryIntakeHeader({
  unreviewedCount,
  onLog,
}: {
  unreviewedCount: number;
  onLog: () => void;
}) {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Inquiry intake</h2>
        </div>
        <div className="flex items-center gap-2">
          {unreviewedCount > 0 && (
            <span className="rounded-full bg-(--prism-amber)/10 px-2.5 py-1 text-xs font-bold text-(--prism-amber)">
              {unreviewedCount} unreviewed
            </span>
          )}
          <Button size="sm" onClick={onLog} className="rounded-lg font-bold">
            <Plus className="size-3.5" />
            Log inquiry
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InquiryIntakeFilters({
  query,
  status,
  source,
  clientType,
  dateRange,
  clientTypes,
  onQuery,
  onStatus,
  onSource,
  onClientType,
  onDateRange,
}: {
  query: string;
  status: string;
  source: string;
  clientType: string;
  dateRange: string;
  clientTypes: string[];
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onSource: (value: string) => void;
  onClientType: (value: string) => void;
  onDateRange: (value: string) => void;
}) {
  const selects = [
    {
      value: status, onChange: onStatus,
      options: [["all", "All status"], ["new", "New"], ["accepted", "Accepted"], ["pending", "Pending"], ["declined", "Declined"]],
    },
    {
      value: source, onChange: onSource,
      options: [["all", "All sources"], ...logFormReferralSources.map((item) => [item, item])],
    },
    {
      value: clientType, onChange: onClientType,
      options: [["all", "All client types"], ...clientTypes.map((item) => [item, item])],
    },
    {
      value: dateRange, onChange: onDateRange,
      options: [["all", "All dates"], ["next_30", "Next 30 days"], ["next_90", "Next 90 days"], ["past_30", "Past 30 days"]],
    },
  ];

  return (
    <div className="border-b border-border px-6 py-3">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_140px_160px_140px_140px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="h-9 pl-9 text-sm"
            placeholder="Search client, email, or event..."
          />
        </div>
        {selects.map((sel, index) => (
          <select
            key={index}
            value={sel.value}
            onChange={(event) => sel.onChange(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {sel.options.map(([val, optionLabel]) => (
              <option key={val} value={val}>{optionLabel}</option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}

export function InquiryIntakeList({
  inquiries,
  onOpen,
}: {
  inquiries: PrismInquiry[];
  onOpen: (inquiry: PrismInquiry) => void;
}) {
  if (inquiries.length === 0) {
    return (
      <div className="px-6 py-8">
        <EmptyState icon={ClipboardList} title="No inquiries match" description="Adjust the filters above to see more inquiries." />
      </div>
    );
  }

  return (
    <div>
      <div className="hidden border-b border-border bg-muted/20 px-6 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground 2xl:grid 2xl:grid-cols-[minmax(280px,1fr)_120px_140px_minmax(150px,0.7fr)_90px] 2xl:gap-4">
        <span>Inquiry</span>
        <span>Status</span>
        <span>Event date</span>
        <span>Source</span>
        <span>Actions</span>
      </div>
      <div className="divide-y divide-border">
        {inquiries.map((inquiry) => (
          <InquiryIntakeRow key={inquiry.id} inquiry={inquiry} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function InquiryIntakeRow({
  inquiry,
  onOpen,
}: {
  inquiry: PrismInquiry;
  onOpen: (inquiry: PrismInquiry) => void;
}) {
  return (
    <div className={`border-l-4 ${inquiryStatusAccent(inquiry.status)} px-6 py-4`}>
      <div className="grid gap-4 2xl:grid-cols-[minmax(280px,1fr)_120px_140px_minmax(150px,0.7fr)_90px] 2xl:items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{inquiry.eventName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">{inquiry.clientName}</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {inquiry.email}
            </span>
          </div>
          {inquiry.message ? (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{inquiry.message}</p>
          ) : null}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Status</p>
          <StatusBadge status={inquiry.status} label={label(inquiry.status)} />
        </div>
        <div className="text-sm font-semibold text-foreground">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Event date</p>
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            {inquiry.eventDate || "Date pending"}
          </span>
        </div>
        <div className="text-sm">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Source</p>
          <p className="font-semibold text-foreground">{inquiry.source || "-"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Received {compactTimestamp(inquiry.createdAt)}</p>
        </div>
        <div className="flex 2xl:justify-end">
          <Button size="sm" variant="outline" onClick={() => onOpen(inquiry)} className="w-full rounded-lg font-bold 2xl:w-auto">
            <Eye className="size-3.5" />
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InquiryDetailDrawer({
  inquiry,
  busy,
  onClose,
  onAccept,
  onPend,
  onDecline,
}: {
  inquiry: PrismInquiry;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onPend: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <button type="button" aria-label="Close inquiry detail" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
        <InquiryDetailHeader inquiry={inquiry} onClose={onClose} />
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <InquiryDetailFlags inquiry={inquiry} />
          <InquiryDetailFields inquiry={inquiry} />
          <section className="rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-(--prism-signal)" />
              <h4 className="text-sm font-bold text-foreground">Inquiry message</h4>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {inquiry.message || "No message provided."}
            </p>
          </section>
          <InquiryExtraDetails inquiry={inquiry} />
        </div>
        <div className="border-t border-border px-6 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <InquiryDetailActions
              status={inquiry.status}
              busy={busy}
              onAccept={onAccept}
              onPend={onPend}
              onDecline={onDecline}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function InquiryDetailHeader({ inquiry, onClose }: { inquiry: PrismInquiry; onClose: () => void }) {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inquiry</p>
          <h3 className="mt-1 truncate text-xl font-black text-foreground">{inquiry.eventName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{inquiry.clientName} - {inquiry.companyName || inquiry.clientType}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close inquiry detail">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function InquiryDetailFlags({ inquiry }: { inquiry: PrismInquiry }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={inquiry.status} label={label(inquiry.status)} />
      {inquiry.duplicate ? (
        <span className="rounded-full border border-(--prism-amber)/25 bg-(--prism-amber)/10 px-2.5 py-1 text-xs font-bold text-(--prism-amber)">
          Duplicate
        </span>
      ) : null}
      {inquiry.previouslyDeclined ? (
        <span className="rounded-full border border-destructive/25 bg-destructive/5 px-2.5 py-1 text-xs font-bold text-destructive">
          Previously declined
        </span>
      ) : null}
    </div>
  );
}

function InquiryDetailFields({ inquiry }: { inquiry: PrismInquiry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailField label="Client" value={inquiry.clientName} />
      <DetailField label="Email" value={inquiry.email} />
      <DetailField label="Company" value={inquiry.companyName || inquiry.clientType} />
      <DetailField label="Event type" value={inquiry.eventType || inquiry.clientType} />
      <DetailField label="Event date" value={inquiry.eventDate} />
      <DetailField label="Source" value={inquiry.source} />
      <DetailField label="Received" value={compactTimestamp(inquiry.createdAt)} />
      <DetailField label="Status updated" value={compactTimestamp(inquiry.acceptedAt || inquiry.pendingAt || inquiry.declinedAt)} />
    </div>
  );
}

function InquiryExtraDetails({ inquiry }: { inquiry: PrismInquiry }) {
  const extra = inquiryExtraDetailFields(inquiry);
  if (extra.length === 0) return null;
  return (
    <section className="space-y-2">
      {extra.map((field) => (
        <DetailField key={field.label} label={field.label} value={field.value} />
      ))}
    </section>
  );
}

function InquiryDetailActions({
  status,
  busy,
  onAccept,
  onPend,
  onDecline,
}: {
  status: string;
  busy: boolean;
  onAccept: () => void;
  onPend: () => void;
  onDecline: () => void;
}) {
  if (status === "accepted") {
    return <p className="mr-auto text-sm font-semibold text-(--prism-success)">Inquiry accepted</p>;
  }
  if (status === "declined") {
    return <p className="mr-auto text-sm font-semibold text-destructive">Inquiry declined</p>;
  }
  return (
    <>
      <Button size="sm" disabled={busy} onClick={onAccept} className="rounded-lg font-bold">
        Accept
      </Button>
      {status !== "pending" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onPend} className="rounded-lg font-bold">
          Pend
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onDecline}
        className="rounded-lg border-destructive/25 font-bold text-destructive hover:bg-destructive/5"
      >
        Decline
      </Button>
    </>
  );
}

export function InquiryDeclineDialog({
  clientName,
  declineReason,
  busy,
  onReason,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  declineReason: string;
  busy: boolean;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-bold text-foreground">Decline inquiry</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the permanent decline reason for {clientName}.
        </p>
        <select
          value={declineReason}
          onChange={(event) => onReason(event.target.value)}
          className="mt-4 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          {declineReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" className="rounded-lg font-bold" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg border-destructive/25 bg-destructive font-bold text-white hover:bg-destructive/90"
          >
            Save decline
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InquiryLogOnBehalfForm({
  logForm,
  setLogForm,
  logPhase,
  logError,
  todayIso,
  firstFieldRef,
  onClose,
  onSubmit,
}: {
  logForm: InquiryLogForm;
  setLogForm: Dispatch<SetStateAction<InquiryLogForm>>;
  logPhase: "idle" | "submitting" | "error";
  logError: string | null;
  todayIso: string;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && logPhase !== "submitting") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [logPhase, onClose]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [firstFieldRef]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Log inquiry on behalf of a client"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Log inquiry on behalf</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Record an inquiry a client gave you by phone or in person.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={logPhase === "submitting"}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <InquiryLogFormFields
          logForm={logForm}
          setLogForm={setLogForm}
          todayIso={todayIso}
          firstFieldRef={firstFieldRef}
        />

        {logError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{logError}</p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-lg font-bold"
            onClick={onClose}
            disabled={logPhase === "submitting"}
          >
            Cancel
          </Button>
          <Button
            className="rounded-lg font-bold"
            disabled={!isInquiryLogFormReady(logForm) || logPhase === "submitting"}
            onClick={onSubmit}
          >
            {logPhase === "submitting" ? "Saving…" : "Save inquiry"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InquiryLogFormFields({
  logForm,
  setLogForm,
  todayIso,
  firstFieldRef,
}: {
  logForm: InquiryLogForm;
  setLogForm: Dispatch<SetStateAction<InquiryLogForm>>;
  todayIso: string;
  firstFieldRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Client name
        </span>
        <Input
          ref={firstFieldRef}
          value={logForm.clientName}
          onChange={(event) => setLogForm((form) => ({ ...form, clientName: event.target.value }))}
          placeholder="Full name"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Company (optional)
        </span>
        <Input
          value={logForm.companyName}
          onChange={(event) => setLogForm((form) => ({ ...form, companyName: event.target.value }))}
          placeholder="Company / organization"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Email
        </span>
        <Input
          type="email"
          value={logForm.email}
          onChange={(event) => setLogForm((form) => ({ ...form, email: event.target.value }))}
          placeholder="client@example.com"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Channel
        </span>
        <select
          value={logForm.channel}
          onChange={(event) => setLogForm((form) => ({ ...form, channel: event.target.value }))}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          {logFormChannels.map((channelOption) => (
            <option key={channelOption} value={channelOption}>
              {channelOption}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Referral Source
        </span>
        <select
          value={logForm.source}
          onChange={(event) => setLogForm((form) => ({ ...form, source: event.target.value }))}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          aria-label="How did you hear about us?"
        >
          {logFormReferralSources.map((sourceOption) => (
            <option key={sourceOption} value={sourceOption}>
              {sourceOption}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Event name
        </span>
        <Input
          value={logForm.eventName}
          onChange={(event) => setLogForm((form) => ({ ...form, eventName: event.target.value }))}
          placeholder="Event name"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Event type
        </span>
        <select
          value={logForm.eventType}
          onChange={(event) => setLogForm((form) => ({ ...form, eventType: event.target.value }))}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="" disabled>
            Select event type
          </option>
          {logFormEventTypes.map((eventTypeOption) => (
            <option key={eventTypeOption} value={eventTypeOption}>
              {eventTypeOption}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Event date
        </span>
        <Input
          type="date"
          min={todayIso}
          value={logForm.eventDate}
          onChange={(event) => setLogForm((form) => ({ ...form, eventDate: event.target.value }))}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Client type
        </span>
        <select
          value={logForm.clientType}
          onChange={(event) => setLogForm((form) => ({ ...form, clientType: event.target.value }))}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="" disabled>
            Select client type
          </option>
          {logFormClientTypes.map((clientTypeOption) => (
            <option key={clientTypeOption} value={clientTypeOption}>
              {clientTypeOption}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Referral details (optional)
        </span>
        <Input
          value={logForm.referralDetails}
          onChange={(event) => setLogForm((form) => ({ ...form, referralDetails: event.target.value }))}
          placeholder="How did they hear about PMCM?"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Message
        </span>
        <textarea
          value={logForm.message}
          onChange={(event) => setLogForm((form) => ({ ...form, message: event.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          placeholder="What the client told you about the event"
        />
      </label>
    </div>
  );
}
