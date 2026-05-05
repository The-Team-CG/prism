"use client";

import { useState } from "react";
import { ClipboardList, Search } from "lucide-react";

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

  const unreviewedCount = inquiries.filter((inq) => inq.status === "new").length;
  const clientTypes = Array.from(new Set(inquiries.map((inq) => inq.clientType).filter(Boolean))).sort();

  const filtered = inquiries
    .filter((inq) => {
      const haystack = `${inq.clientName} ${inq.companyName ?? ""} ${inq.eventName}`.toLowerCase();
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
        <div className="flex items-center justify-between gap-3">
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
        <p className="mt-1 text-xs text-muted-foreground">
          Incoming inquiry cards, organized by date received.
        </p>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-6 py-3">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_140px_160px_140px_140px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
              placeholder="Search client or event…"
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
              {sel.options.map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {/* Inquiry list */}
      {filtered.length === 0 ? (
        <div className="px-6 py-8">
          <EmptyState icon={ClipboardList} title="No inquiries match" description="Adjust the filters above to see more inquiries." />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((inq) => (
            <div
              key={inq.id}
              className={`border-l-4 ${statusAccent(inq.status)} px-6 py-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{inq.clientName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{inq.companyName || inq.clientType}</p>
                </div>
                <StatusBadge status={inq.status} label={label(inq.status)} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Event type", value: inq.eventType || inq.clientType },
                  { label: "Approx. date", value: inq.eventDate },
                  { label: "Source", value: inq.source },
                  { label: "Received", value: compactTimestamp(inq.createdAt) },
                ].map(({ label: lbl, value }) => (
                  <div key={lbl} className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--prism-signal)">{lbl}</p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">{value || "—"}</p>
                  </div>
                ))}
              </div>

              {(inq.duplicate || inq.previouslyDeclined || inq.referralDetails || inq.loggedByName) && (
                <div className="mt-3 space-y-1.5">
                  {inq.duplicate && (
                    <p className="rounded-lg border border-(--prism-amber)/20 bg-(--prism-amber)/8 px-3 py-2 text-xs font-semibold text-(--prism-amber)">
                      Duplicate of {inq.duplicateOfInquiryId}
                    </p>
                  )}
                  {inq.previouslyDeclined && (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                      Previous rejection: {inq.previousDeclineReason}
                    </p>
                  )}
                  {inq.referralDetails && (
                    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground">
                      Referral: {inq.referralDetails}
                    </p>
                  )}
                  {inq.loggedByName && (
                    <p className="rounded-lg border border-(--prism-signal)/20 bg-(--prism-signal)/8 px-3 py-2 text-xs font-semibold text-(--prism-signal)">
                      Logged by {inq.loggedByName}
                    </p>
                  )}
                </div>
              )}

              {inq.declineReason && (
                <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                  Declined: {inq.declineReason}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy || inq.status === "accepted" || inq.status === "declined"}
                  onClick={() => onAccept(inq)}
                  className="rounded-lg font-bold"
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || inq.status === "pending" || inq.status === "declined"}
                  onClick={() => onPend(inq)}
                  className="rounded-lg font-bold"
                >
                  Pend
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || inq.status === "declined"}
                  onClick={() => setDeclining(inq)}
                  className="rounded-lg border-destructive/25 font-bold text-destructive hover:bg-destructive/5"
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decline modal */}
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
              {declineReasons.map((r) => <option key={r} value={r}>{r}</option>)}
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
