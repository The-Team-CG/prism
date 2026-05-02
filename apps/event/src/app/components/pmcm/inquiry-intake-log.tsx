"use client";

import { useState } from "react";
import { ClipboardList, Search } from "lucide-react";

import { Input } from "@/app/components/ui/input";
import type { MvpInquiry } from "@/lib/mvp-api";
import { compactTimestamp, cx, label } from "./helpers";
import { Panel } from "./primitives";

const inquirySources = ["Facebook", "Website", "BNI", "Walk-In", "Log on Behalf"];
const declineReasons = ["Date Unavailable", "Outside Service Scope", "Budget Too Low", "Prior Issue", "Other"];

function statusTone(status: string) {
  if (status === "new") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (status === "accepted") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "pending") return "bg-amber-50 text-amber-800 ring-amber-100";
  if (status === "declined") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-[#c01867]/10 text-[#c01867] ring-primary/15";
}

function dateRangeMatches(value: string, range: string) {
  if (range === "all") return true;
  const date = new Date(value);
  const now = new Date();
  const days = Math.floor((date.getTime() - now.getTime()) / 86_400_000);
  if (range === "next_30") return days >= 0 && days <= 30;
  if (range === "next_90") return days >= 0 && days <= 90;
  if (range === "past_30") return days < 0 && days >= -30;
  return true;
}

export function InquiryIntakeLog({
  inquiries,
  onAccept,
  onPend,
  onDecline,
  busy,
}: {
  inquiries: MvpInquiry[];
  onAccept: (inquiry: MvpInquiry) => Promise<void>;
  onPend: (inquiry: MvpInquiry) => Promise<void>;
  onDecline: (inquiry: MvpInquiry, reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [clientType, setClientType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [declining, setDeclining] = useState<MvpInquiry | null>(null);
  const [declineReason, setDeclineReason] = useState(declineReasons[0]);
  const unreviewedCount = inquiries.filter((inquiry) => inquiry.status === "new").length;
  const clientTypes = Array.from(new Set(inquiries.map((inquiry) => inquiry.clientType).filter(Boolean))).sort();
  const filtered = inquiries
    .filter((inquiry) => {
      const haystack = `${inquiry.clientName} ${inquiry.companyName ?? ""} ${inquiry.eventName}`.toLowerCase();
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
      if (status !== "all" && inquiry.status !== status) return false;
      if (source !== "all" && inquiry.source !== source) return false;
      if (clientType !== "all" && inquiry.clientType !== clientType) return false;
      return dateRangeMatches(inquiry.eventDate, dateRange);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function confirmDecline() {
    if (!declining) return;
    await onDecline(declining, declineReason);
    setDeclining(null);
    setDeclineReason(declineReasons[0]);
  }

  return (
    <Panel title="Inquiry Intake Log" icon={ClipboardList}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Incoming inquiry cards are organized by date received and poll every 30 seconds while this dashboard is open.
        </p>
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">
          {unreviewedCount} unreviewed
        </div>
      </div>

      <div className="mt-4 grid gap-2 xl:grid-cols-[minmax(240px,1fr)_150px_170px_150px_150px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 bg-white pl-9" placeholder="Search client or company..." />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All status</option>
          <option value="new">New</option>
          <option value="accepted">Accepted</option>
          <option value="pending">Pending</option>
          <option value="declined">Declined</option>
        </select>
        <select value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All sources</option>
          {inquirySources.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={clientType} onChange={(event) => setClientType(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All client types</option>
          {clientTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All dates</option>
          <option value="next_30">Next 30 days</option>
          <option value="next_90">Next 90 days</option>
          <option value="past_30">Past 30 days</option>
        </select>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {filtered.map((inquiry) => (
          <div key={inquiry.id} className="rounded-lg border border-border bg-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black">{inquiry.clientName}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{inquiry.companyName || inquiry.clientType}</p>
              </div>
              <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", statusTone(inquiry.status))}>
                {label(inquiry.status)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-background p-3"><p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Event Type</p><p className="mt-1 font-semibold">{inquiry.eventType || inquiry.clientType}</p></div>
              <div className="rounded-md bg-background p-3"><p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Approx. Date</p><p className="mt-1 font-semibold">{inquiry.eventDate}</p></div>
              <div className="rounded-md bg-background p-3"><p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Source</p><p className="mt-1 font-semibold">{inquiry.source}</p></div>
              <div className="rounded-md bg-background p-3"><p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Received</p><p className="mt-1 font-semibold">{compactTimestamp(inquiry.createdAt)}</p></div>
            </div>
            {(inquiry.duplicate || inquiry.previouslyDeclined || inquiry.referralDetails || inquiry.loggedByName) && (
              <div className="mt-3 grid gap-2 text-xs font-semibold">
                {inquiry.duplicate && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">Duplicate of {inquiry.duplicateOfInquiryId}</p>}
                {inquiry.previouslyDeclined && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">Previous rejection: {inquiry.previousDeclineReason}</p>}
                {inquiry.referralDetails && <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">Referral: {inquiry.referralDetails}</p>}
                {inquiry.loggedByName && <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">Logged by {inquiry.loggedByName}</p>}
              </div>
            )}
            {inquiry.declineReason && (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Declined: {inquiry.declineReason}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy || inquiry.status === "accepted" || inquiry.status === "declined"} onClick={() => onAccept(inquiry)} className="h-9 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-50">Accept</button>
              <button disabled={busy || inquiry.status === "pending" || inquiry.status === "declined"} onClick={() => onPend(inquiry)} className="h-9 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-50">Pend</button>
              <button disabled={busy || inquiry.status === "declined"} onClick={() => setDeclining(inquiry)} className="h-9 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-50">Decline</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            No inquiries match the active filters.
          </div>
        )}
      </div>

      {declining && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-[0_24px_80px_rgba(23,18,22,0.28)]">
            <h3 className="text-xl font-black">Decline inquiry</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Select the permanent decline reason for {declining.clientName}.</p>
            <select value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} className="mt-4 h-11 w-full rounded-md border border-border bg-white px-3 text-sm">
              {declineReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeclining(null)} className="h-9 rounded-md border border-border bg-white px-3 text-xs font-black">Cancel</button>
              <button disabled={busy} onClick={confirmDecline} className="h-9 rounded-md bg-rose-600 px-3 text-xs font-black text-white disabled:opacity-60">Save decline</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
