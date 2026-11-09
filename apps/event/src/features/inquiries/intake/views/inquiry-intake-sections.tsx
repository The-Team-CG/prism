"use client";

import { useId, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@prism/ui/components/sheet";
import { InquiryTriagePanel } from "@/features/inquiries/triage";
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Input } from "@prism/ui/components/input";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@prism/ui/components/empty";
import type { PrismInquiry } from "@prism/types";
import { CompanyNameEditor } from "@/features/inquiries/company-name/views/company-name-editor";
import { BiddingPathEditor } from "@/features/inquiries/bidding-path/views/bidding-path-editor";
import { ClientLanguageSelect } from "@/features/inquiries/client-language/views/client-language-select";
import { ContextNotesLog } from "@/features/inquiries/context-notes/views/context-notes-log";
import { PreConformeDocuments } from "@/features/inquiries/pre-conforme-documents/views/pre-conforme-documents";
import { compactTimestamp, label } from "@/features/pmcm-kit";
import {
  AWAITING_REVIEW,
  canMergeInquiry,
  declineReasons,
  inquiryExtraDetailFields,
  inquiryHistoryCues,
  inquiryLogMissingFields,
  inquiryMergeCandidates,
  logFormChannels,
  logFormClientTypes,
  logFormEventTypes,
  logFormReferralSources,
  type InquiryLogForm,
  inquiryNextStep,
} from "../model/inquiry-intake-rules";

function DetailField({ label: fieldLabel, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{fieldLabel}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
}

export function InquiryIntakeHeader({
  unreviewedCount,
  onLog,
  onCopyInquiryLink,
  copyLinkState,
}: {
  unreviewedCount: number;
  onLog: () => void;
  onCopyInquiryLink: () => void;
  copyLinkState: "idle" | "copied" | "error";
}) {
  return (
    <div className="px-4 pb-4 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-foreground">Inquiry intake</h2>
          {unreviewedCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreviewedCount} awaiting review</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCopyInquiryLink} className="h-11 rounded-lg px-2 font-semibold text-muted-foreground shadow-none sm:h-9">
            {copyLinkState === "copied" ? "Link copied" : "Copy inquiry link"}
          </Button>
          <Button size="sm" onClick={onLog} className="h-11 rounded-lg font-semibold sm:h-9">
            <Plus aria-hidden className="size-3.5" />
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
  const idPrefix = useId();
  const searchId = `${idPrefix}-search`;
  const statusId = `${idPrefix}-status`;
  const moreFiltersId = `${idPrefix}-more-filters`;
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const activeSecondaryCount = [source, clientType, dateRange].filter((value) => value !== "all").length;
  const selects = [
    {
      key: "source", label: "Source", value: source, onChange: onSource,
      options: [["all", "All sources"], ...logFormReferralSources.map((item) => [item, item])],
    },
    {
      key: "client-type", label: "Client type", value: clientType, onChange: onClientType,
      options: [["all", "All client types"], ...clientTypes.map((item) => [item, item])],
    },
    {
      key: "date-range", label: "Event date", value: dateRange, onChange: onDateRange,
      options: [["all", "All dates"], ["next_30", "Next 30 days"], ["next_90", "Next 90 days"], ["past_30", "Past 30 days"]],
    },
  ];

  return (
    <div role="search" aria-label="Filter inquiries" className="border-b border-border px-4 pb-4 sm:px-6">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_13rem_auto]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1">
          <label htmlFor={searchId} className="sr-only">Search inquiries</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="h-11 w-full min-w-0 pl-9 text-sm sm:h-9"
            placeholder="Search event, client or email…"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={statusId} className="sr-only">Status</label>
          <Select value={status} onValueChange={onStatus}>
            <SelectTrigger id={statusId} className="h-11 w-full min-w-0 rounded-lg bg-card sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AWAITING_REVIEW}>Awaiting review</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={moreFiltersOpen}
          aria-controls={moreFiltersId}
          onClick={() => setMoreFiltersOpen((open) => !open)}
          className="h-11 rounded-lg font-medium shadow-none sm:h-9"
        >
          <SlidersHorizontal aria-hidden className="size-3.5" />
          More filters{activeSecondaryCount > 0 ? ` (${activeSecondaryCount})` : ""}
        </Button>
      </div>
      <div
        id={moreFiltersId}
        hidden={!moreFiltersOpen}
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {selects.map((sel) => {
          const selectId = `${idPrefix}-${sel.key}`;
          return (
            <div key={sel.key} className="min-w-0">
              <label htmlFor={selectId} className="mb-1.5 block text-xs font-medium text-muted-foreground">{sel.label}</label>
              <Select value={sel.value} onValueChange={sel.onChange}>
                <SelectTrigger id={selectId} className="h-11 w-full min-w-0 rounded-lg bg-card sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sel.options.map(([val, optionLabel]) => (
                    <SelectItem key={val} value={val}>{optionLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
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
        <Empty className="border-0 p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList aria-hidden /></EmptyMedia>
            <EmptyTitle>No inquiries match</EmptyTitle>
            <EmptyDescription>Adjust the filters above to see more inquiries.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Table className="table-fixed">
        <colgroup className="hidden lg:table-column-group">
          <col />
          <col className="w-32" />
          <col className="w-40 xl:w-48" />
          <col className="w-28" />
        </colgroup>
        <TableHeader className="hidden border-b border-border bg-muted/25 text-left text-xs text-muted-foreground lg:table-header-group">
          <TableRow>
            <TableHead className="h-auto whitespace-normal px-6 py-3 font-medium">Event and contact</TableHead>
            <TableHead className="h-auto whitespace-normal px-3 py-3 font-medium">Event date</TableHead>
            <TableHead className="h-auto whitespace-normal px-3 py-3 font-medium">Status</TableHead>
            <TableHead className="h-auto whitespace-normal px-6 py-3"><span className="sr-only">Action</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {inquiries.map((inquiry) => (
            <InquiryIntakeRow key={inquiry.id} inquiry={inquiry} onOpen={onOpen} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const NEXT_STEP_TONE = {
  action: "font-medium text-foreground",
  waiting: "text-attention",
  done: "text-muted-foreground",
} as const;

function InquiryIntakeRow({
  inquiry,
  onOpen,
}: {
  inquiry: PrismInquiry;
  onOpen: (inquiry: PrismInquiry) => void;
}) {
  const next = inquiryNextStep(inquiry);
  return (
    <TableRow className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-3 hover:bg-surface-raised sm:px-6 lg:table-row lg:p-0">
      <TableCell className="p-0 whitespace-normal col-span-2 min-w-0 align-top lg:px-6 lg:py-2.5">
        <p className="break-words font-semibold text-foreground" title={inquiry.eventName}>{inquiry.eventName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={`${inquiry.clientName} · ${inquiry.email}`}>
          {inquiry.clientName} · {inquiry.email} · Received {compactTimestamp(inquiry.createdAt)}
          {inquiry.source ? <> · {inquiry.source}</> : null}
        </p>
        {inquiry.previouslyDeclined ? <p className="mt-0.5 text-xs font-semibold text-destructive">Previously declined</p> : null}
        {inquiry.pendingFullDetails ? <p className="mt-0.5 text-xs font-semibold text-attention">Pending Full Details</p> : null}
      </TableCell>
      <TableCell className="p-0 whitespace-normal col-start-1 row-start-2 whitespace-nowrap align-top text-foreground lg:px-3 lg:py-2.5">
        <span className="block text-xs text-muted-foreground lg:hidden">Event date</span>
        {formatPortalDate(inquiry.eventDate)}
      </TableCell>
      <TableCell className="p-0 whitespace-normal col-start-1 row-start-3 min-w-0 align-top lg:px-3 lg:py-2.5">
        <StatusBadge status={inquiry.status} label={label(inquiry.status)} />
        {inquiry.status === "accepted" ? (
          <p className={`mt-1 text-xs leading-5 ${NEXT_STEP_TONE[next.tone]}`}>{next.label}</p>
        ) : null}
      </TableCell>
      <TableCell className="p-0 whitespace-normal col-start-2 row-span-2 row-start-2 self-center align-top lg:py-2 lg:pl-0 lg:pr-6 lg:text-right">
        <button type="button" onClick={() => onOpen(inquiry)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:border-transparent lg:px-2">
          Review<span className="sr-only"> inquiry {inquiry.eventName}</span>
          <ChevronRight aria-hidden className="size-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

export function InquiryDetailDrawer({
  inquiry,
  busy,
  onClose,
  onAccept,
  onPend,
  onDecline,
  allInquiries,
  onMerge,
}: {
  inquiry: PrismInquiry;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onPend: () => void;
  onDecline: () => void;
  allInquiries: PrismInquiry[];
  onMerge: (primary: PrismInquiry, reason: string) => Promise<void>;
}) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" showCloseButton={false} className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetTitle className="sr-only">Review inquiry: {inquiry.eventName}</SheetTitle>
        <SheetDescription className="sr-only">Review the client’s request and history before accepting, putting it on hold, or declining.</SheetDescription>
        <InquiryDetailHeader inquiry={inquiry} onClose={onClose} />
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <InquiryDetailFlags inquiry={inquiry} />
          <InquiryDetailFields inquiry={inquiry} />
          <InquiryHistorySection inquiry={inquiry} allInquiries={allInquiries} busy={busy} onMerge={onMerge} />
          <section className="rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Inquiry message</h4>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {inquiry.message || "No message provided."}
            </p>
          </section>
          <InquiryTriagePanel inquiryId={inquiry.id} />
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
      </SheetContent>
    </Sheet>
  );
}

function InquiryDetailHeader({ inquiry, onClose }: { inquiry: PrismInquiry; onClose: () => void }) {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Inquiry</p>
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
      {inquiry.pendingFullDetails ? <span className="text-xs font-semibold text-attention">Pending Full Details</span> : null}
      {inquiry.duplicate ? (
        <span className="rounded-full border border-attention/25 bg-attention/10 px-2.5 py-1 text-xs font-bold text-attention">
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
  // Shown only once PMCM has actually changed the status; an untouched inquiry has no update to report.
  const statusUpdatedAt = inquiry.acceptedAt || inquiry.pendingAt || inquiry.declinedAt;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailField label="Client" value={inquiry.clientName} />
      <DetailField label="Email" value={inquiry.email} />
      <DetailField label="Company" value={inquiry.companyName || inquiry.clientType} />
      <DetailField label="Event type" value={inquiry.eventType || inquiry.clientType} />
      <DetailField label="Event date" value={formatPortalDate(inquiry.eventDate)} />
      <DetailField label="Source" value={inquiry.source} />
      <DetailField label="Received" value={compactTimestamp(inquiry.createdAt)} />
      {statusUpdatedAt ? <DetailField label="Status updated" value={formatPortalDateTime(statusUpdatedAt)} /> : null}
    </div>
  );
}

function InquiryHistorySection({
  inquiry,
  allInquiries,
  busy,
  onMerge,
}: {
  inquiry: PrismInquiry;
  allInquiries: PrismInquiry[];
  busy: boolean;
  onMerge: (primary: PrismInquiry, reason: string) => Promise<void>;
}) {
  const cues = inquiryHistoryCues(inquiry, allInquiries);
  const candidates = inquiryMergeCandidates(inquiry, allInquiries);
  const mergeAllowed = canMergeInquiry(inquiry);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-background px-4 py-3">
      <CompanyNameEditor inquiryId={inquiry.id} companyName={inquiry.companyName ?? ""} />
      <BiddingPathEditor inquiry={inquiry} />
      <ClientLanguageSelect inquiry={inquiry} />
      <ContextNotesLog inquiryId={inquiry.id} />
      <PreConformeDocuments inquiryId={inquiry.id} conformeSigned={Boolean(inquiry.conformeSignedAt)} />
      <div className="flex items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <h4 className="text-sm font-bold text-foreground">Organization and history</h4>
      </div>
      {cues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No duplicate, decline, or organization history on record.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {cues.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      )}
      {mergeAllowed && candidates.length > 0 ? (
        <InquiryMergeForm candidates={candidates} busy={busy} onMerge={onMerge} />
      ) : null}
    </section>
  );
}

function InquiryMergeForm({
  candidates,
  busy,
  onMerge,
}: {
  candidates: PrismInquiry[];
  busy: boolean;
  onMerge: (primary: PrismInquiry, reason: string) => Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState(candidates[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const primary = candidates.find((candidate) => candidate.id === primaryId) ?? candidates[0];

  async function submit() {
    if (!primary || !reason.trim()) return;
    setError(null);
    try {
      await onMerge(primary, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <label className="block text-xs font-bold text-muted-foreground" htmlFor="inquiry-merge-primary">
        Merge this inquiry into
      </label>
      <Select value={primary?.id ?? ""} onValueChange={setPrimaryId}>
        <SelectTrigger id="inquiry-merge-primary" className="h-9 w-full min-w-0 rounded-lg bg-card">
          <SelectValue placeholder="Choose an inquiry" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.clientName} - {candidate.eventName} ({candidate.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        aria-label="Merge reason"
        placeholder="Reason for merging (kept in the audit trail)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={busy || !reason.trim() || !primary} onClick={() => void submit()} className="rounded-lg font-bold">
          Merge inquiry
        </Button>
      </div>
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
    return <p className="mr-auto text-sm font-semibold text-success">Inquiry accepted</p>;
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
          Put on hold
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

/**
 * Confirms a permanent decline. The reason is optional: an empty choice sends the decline with no reason.
 * Nothing is sent until the PMCM user confirms.
 */
export function InquiryDeclineDialog({
  clientName,
  clientEmail,
  declineReason,
  busy,
  onReason,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  clientEmail: string;
  declineReason: string;
  busy: boolean;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reasonId = useId();
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Decline inquiry from {clientName}?</DialogTitle>
          <DialogDescription>
            A declined inquiry can&apos;t be reopened. The reason is optional and is kept on the inquiry and in the audit log.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">We&apos;ll email {clientEmail} to let them know.</p>
        <div className="grid gap-1.5">
          <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
            Decline reason <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Select value={declineReason || NO_DECLINE_REASON} onValueChange={(value) => onReason(value === NO_DECLINE_REASON ? "" : value)}>
            <SelectTrigger id={reasonId} className="h-11 w-full rounded-xl bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DECLINE_REASON}>No reason given</SelectItem>
              {declineReasons.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="mt-5">
          <Button variant="outline" className="rounded-lg font-bold" onClick={onCancel} disabled={busy}>
            Keep inquiry
          </Button>
          <Button
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg border-destructive/25 bg-destructive font-bold text-white hover:bg-destructive/90"
          >
            Decline inquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Radix Select cannot take an empty-string item value, so "no reason" uses this sentinel. */
const NO_DECLINE_REASON = "__no_decline_reason__";

function RequiredMark() {
  return <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>;
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
  const missingFields = inquiryLogMissingFields(logForm);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && logPhase !== "submitting") onClose(); }}>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstFieldRef.current?.focus();
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base font-bold text-foreground">Log inquiry on behalf</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Record an inquiry a client gave you by phone or in person. Nothing is emailed to the client.
            </DialogDescription>
          </DialogHeader>
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

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {missingFields.length > 0 && logPhase !== "submitting" ? (
            <p className="mr-auto text-xs text-muted-foreground">Fill in {missingFields.join(", ")} to save.</p>
          ) : null}
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
            disabled={missingFields.length > 0 || logPhase === "submitting"}
            onClick={onSubmit}
          >
            {logPhase === "submitting" ? "Saving…" : "Save inquiry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A visible label tied to its control by id, with a required marker the screen reader skips. */
function LogField({
  id,
  label: fieldLabel,
  required = false,
  optional = false,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`text-sm ${className}`}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {fieldLabel}
        {required ? <RequiredMark /> : null}
        {optional ? <span className="font-normal"> (optional)</span> : null}
      </label>
      {children}
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
  const update = (patch: Partial<InquiryLogForm>) => setLogForm((form) => ({ ...form, ...patch }));
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <LogField id="log-client-name" label="Client name" required>
        <Input
          id="log-client-name"
          ref={firstFieldRef}
          aria-required="true"
          value={logForm.clientName}
          onChange={(event) => update({ clientName: event.target.value })}
          placeholder="Full name"
        />
      </LogField>
      <LogField id="log-company" label="Company" optional>
        <Input
          id="log-company"
          value={logForm.companyName}
          onChange={(event) => update({ companyName: event.target.value })}
          placeholder="Company / organization"
        />
      </LogField>
      <LogField id="log-email" label="Email" required>
        <Input
          id="log-email"
          type="email"
          aria-required="true"
          value={logForm.email}
          onChange={(event) => update({ email: event.target.value })}
          placeholder="client@example.com"
        />
      </LogField>
      <LogField id="log-channel" label="Channel" required>
        <Select value={logForm.channel} onValueChange={(value) => update({ channel: value })}>
          <SelectTrigger id="log-channel" aria-required="true" className="w-full min-w-0">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {logFormChannels.map((channelOption) => <SelectItem key={channelOption} value={channelOption}>{channelOption}</SelectItem>)}
          </SelectContent>
        </Select>
      </LogField>
      <LogField id="log-referral-source" label="Referral source" required>
        <Select value={logForm.source} onValueChange={(value) => update({ source: value })}>
          <SelectTrigger id="log-referral-source" aria-required="true" className="w-full min-w-0">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {logFormReferralSources.map((sourceOption) => <SelectItem key={sourceOption} value={sourceOption}>{sourceOption}</SelectItem>)}
          </SelectContent>
        </Select>
      </LogField>
      <LogField id="log-event-name" label="Event name" required>
        <Input
          id="log-event-name"
          aria-required="true"
          value={logForm.eventName}
          onChange={(event) => update({ eventName: event.target.value })}
          placeholder="Event name"
        />
      </LogField>
      <LogField id="log-event-type" label="Event type" required>
        <Select value={logForm.eventType} onValueChange={(value) => update({ eventType: value })}>
          <SelectTrigger id="log-event-type" aria-required="true" className="w-full min-w-0">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {logFormEventTypes.map((eventTypeOption) => <SelectItem key={eventTypeOption} value={eventTypeOption}>{eventTypeOption}</SelectItem>)}
          </SelectContent>
        </Select>
      </LogField>
      <LogField id="log-event-date" label="Event date" required>
        <DatePicker
          id="log-event-date"
          aria-label="Event date"
          aria-required="true"
          min={todayIso}
          value={logForm.eventDate}
          onValueChange={(value) => update({ eventDate: value })}
        />
      </LogField>
      <LogField id="log-client-type" label="Client type" required>
        <Select value={logForm.clientType} onValueChange={(value) => update({ clientType: value })}>
          <SelectTrigger id="log-client-type" aria-required="true" className="w-full min-w-0">
            <SelectValue placeholder="Select client type" />
          </SelectTrigger>
          <SelectContent>
            {logFormClientTypes.map((clientTypeOption) => <SelectItem key={clientTypeOption} value={clientTypeOption}>{clientTypeOption}</SelectItem>)}
          </SelectContent>
        </Select>
      </LogField>
      <LogField id="log-referral-details" label="Referral details" optional className="sm:col-span-2">
        <Input
          id="log-referral-details"
          value={logForm.referralDetails}
          onChange={(event) => update({ referralDetails: event.target.value })}
          placeholder="How did they hear about PMCM?"
        />
      </LogField>
      <LogField id="log-message" label="Message" required className="sm:col-span-2">
        <textarea
          id="log-message"
          aria-required="true"
          value={logForm.message}
          onChange={(event) => update({ message: event.target.value })}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          placeholder="What the client told you about the event"
        />
      </LogField>
    </div>
  );
}
