"use client";

import { useState } from "react";
import { CalendarDays, ClipboardList, Eye, Mail, MessageSquareText, Search, X } from "lucide-react";

import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { MvpInquiry } from "@/lib/mvp-api";
import { compactTimestamp, label } from "./helpers";

const inquirySources = ["Facebook", "Website", "BNI", "Walk-In", "Log on Behalf"];
const declineReasons = ["Date Unavailable", "Outside Service Scope", "Budget Too Low", "Prior Issue", "Other"];

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

function statusAccent(status: string) {
  if (status === "new") return "border-l-(--prism-amber)";
  if (status === "accepted") return "border-l-(--prism-success)";
  if (status === "declined") return "border-l-destructive";
  return "border-l-border";
}

function DetailField({ label: fieldLabel, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{fieldLabel}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
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
  const [opened, setOpened] = useState<MvpInquiry | null>(null);
  const [declining, setDeclining] = useState<MvpInquiry | null>(null);
  const [declineReason, setDeclineReason] = useState(declineReasons[0]);

  const unreviewedCount = inquiries.filter((inq) => inq.status === "new").length;
  const clientTypes = Array.from(new Set(inquiries.map((inq) => inq.clientType).filter(Boolean))).sort();

  const filtered = inquiries
    .filter((inq) => {
      const haystack = `${inq.clientName} ${inq.companyName ?? ""} ${inq.email} ${inq.eventName}`.toLowerCase();
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
      if (status !== "all" && inq.status !== status) return false;
      if (source !== "all" && inq.source !== source) return false;
      if (clientType !== "all" && inq.clientType !== clientType) return false;
      return dateRangeMatches(inq.eventDate, dateRange);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function confirmDecline() {
    if (!declining) return;
    await onDecline(declining, declineReason);
    setDeclining(null);
    setDeclineReason(declineReasons[0]);
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Inquiry intake</h2>
          </div>
          {unreviewedCount > 0 && (
            <span className="rounded-full bg-(--prism-amber)/10 px-2.5 py-1 text-xs font-bold text-(--prism-amber)">
              {unreviewedCount} unreviewed
            </span>
          )}
        </div>
      </div>

      <div className="border-b border-border px-6 py-3">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_140px_160px_140px_140px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
              placeholder="Search client, email, or event..."
            />
          </div>
          {[
            {
              value: status, onChange: setStatus,
              options: [["all", "All status"], ["new", "New"], ["accepted", "Accepted"], ["pending", "Pending"], ["declined", "Declined"]],
            },
            {
              value: source, onChange: setSource,
              options: [["all", "All sources"], ...inquirySources.map((s) => [s, s])],
            },
            {
              value: clientType, onChange: setClientType,
              options: [["all", "All client types"], ...clientTypes.map((t) => [t, t])],
            },
            {
              value: dateRange, onChange: setDateRange,
              options: [["all", "All dates"], ["next_30", "Next 30 days"], ["next_90", "Next 90 days"], ["past_30", "Past 30 days"]],
            },
          ].map((sel, i) => (
            <select
              key={i}
              value={sel.value}
              onChange={(e) => sel.onChange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              {sel.options.map(([val, optionLabel]) => (
                <option key={val} value={val}>{optionLabel}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-8">
          <EmptyState icon={ClipboardList} title="No inquiries match" description="Adjust the filters above to see more inquiries." />
        </div>
      ) : (
        <div>
          <div className="hidden border-b border-border bg-muted/20 px-6 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground 2xl:grid 2xl:grid-cols-[minmax(280px,1fr)_120px_140px_minmax(150px,0.7fr)_90px] 2xl:gap-4">
            <span>Inquiry</span>
            <span>Status</span>
            <span>Event date</span>
            <span>Source</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((inq) => (
              <div key={inq.id} className={`border-l-4 ${statusAccent(inq.status)} px-6 py-4`}>
                <div className="grid gap-4 2xl:grid-cols-[minmax(280px,1fr)_120px_140px_minmax(150px,0.7fr)_90px] 2xl:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{inq.eventName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="truncate">{inq.clientName}</span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3" />
                        {inq.email}
                      </span>
                    </div>
                    {inq.message ? (
                      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{inq.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Status</p>
                    <StatusBadge status={inq.status} label={label(inq.status)} />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Event date</p>
                    <span className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {inq.eventDate || "Date pending"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground 2xl:hidden">Source</p>
                    <p className="font-semibold text-foreground">{inq.source || "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Received {compactTimestamp(inq.createdAt)}</p>
                  </div>
                  <div className="flex 2xl:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setOpened(inq)} className="w-full rounded-lg font-bold 2xl:w-auto">
                      <Eye className="size-3.5" />
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {opened && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <button type="button" aria-label="Close inquiry detail" className="absolute inset-0 cursor-default" onClick={() => setOpened(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inquiry</p>
                  <h3 className="mt-1 truncate text-xl font-black text-foreground">{opened.eventName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{opened.clientName} - {opened.companyName || opened.clientType}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => setOpened(null)} aria-label="Close inquiry detail">
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={opened.status} label={label(opened.status)} />
                {opened.duplicate ? (
                  <span className="rounded-full border border-(--prism-amber)/25 bg-(--prism-amber)/10 px-2.5 py-1 text-xs font-bold text-(--prism-amber)">
                    Duplicate
                  </span>
                ) : null}
                {opened.previouslyDeclined ? (
                  <span className="rounded-full border border-destructive/25 bg-destructive/5 px-2.5 py-1 text-xs font-bold text-destructive">
                    Previously declined
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Client" value={opened.clientName} />
                <DetailField label="Email" value={opened.email} />
                <DetailField label="Company" value={opened.companyName || opened.clientType} />
                <DetailField label="Event type" value={opened.eventType || opened.clientType} />
                <DetailField label="Event date" value={opened.eventDate} />
                <DetailField label="Source" value={opened.source} />
                <DetailField label="Received" value={compactTimestamp(opened.createdAt)} />
                <DetailField label="Status updated" value={compactTimestamp(opened.acceptedAt || opened.pendingAt || opened.declinedAt)} />
              </div>

              <section className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-(--prism-signal)" />
                  <h4 className="text-sm font-bold text-foreground">Inquiry message</h4>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {opened.message || "No message provided."}
                </p>
              </section>

              {(opened.referralDetails || opened.loggedByName || opened.duplicateOfInquiryId || opened.previousDeclineReason || opened.declineReason) && (
                <section className="space-y-2">
                  {opened.referralDetails && <DetailField label="Referral" value={opened.referralDetails} />}
                  {opened.loggedByName && <DetailField label="Logged by" value={opened.loggedByName} />}
                  {opened.duplicateOfInquiryId && <DetailField label="Duplicate of" value={opened.duplicateOfInquiryId} />}
                  {opened.previousDeclineReason && <DetailField label="Previous decline" value={opened.previousDeclineReason} />}
                  {opened.declineReason && <DetailField label="Decline reason" value={opened.declineReason} />}
                </section>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              <div className="flex flex-wrap justify-end gap-2">
                {opened.status === "accepted" ? (
                  <p className="mr-auto text-sm font-semibold text-(--prism-success)">Inquiry accepted</p>
                ) : opened.status === "declined" ? (
                  <p className="mr-auto text-sm font-semibold text-destructive">Inquiry declined</p>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => onAccept(opened)}
                      className="rounded-lg font-bold"
                    >
                      Accept
                    </Button>
                    {opened.status !== "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onPend(opened)}
                        className="rounded-lg font-bold"
                      >
                        Pend
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setDeclining(opened)}
                      className="rounded-lg border-destructive/25 font-bold text-destructive hover:bg-destructive/5"
                    >
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {declining && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-foreground">Decline inquiry</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the permanent decline reason for {declining.clientName}.
            </p>
            <select
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="mt-4 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {declineReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-lg font-bold" onClick={() => setDeclining(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={confirmDecline}
                className="rounded-lg border-destructive/25 bg-destructive font-bold text-white hover:bg-destructive/90"
              >
                Save decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
