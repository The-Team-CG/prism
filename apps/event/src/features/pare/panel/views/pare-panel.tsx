"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  PhilippinePeso,
  RefreshCw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Truck,
  UserX,
  Zap,
} from "lucide-react";
import type { PrismSupplier, PAREApprovalRecord, PARERisk } from "@prism/types";
import type { SupplierQuoteRequestRow } from "@/features/pmcm-kit";
import { money } from "@/features/pmcm-kit";
import { useParePanelViewModel } from "../view-models/use-pare-panel-view-model";
import {
  formatPareTier,
  pareBudgetTone,
  pareModeCopy,
  pareResultCountLabel,
  pareRiskColor,
} from "../model/pare-panel-rules";

// ─── helpers ─────────────────────────────────────────────────────────────────

function riskIcon(level: PARERisk["level"]) {
  if (level === "HIGH") return <ShieldAlert className="size-4 shrink-0" />;
  if (level === "MEDIUM") return <AlertTriangle className="size-4 shrink-0" />;
  return <CheckCircle2 className="size-4 shrink-0" />;
}

function StatusPill({ status }: { status: PAREApprovalRecord["status"] }) {
  const cls =
    status === "approved" ? "bg-success-soft text-success border-success/25"
    : status === "rejected" ? "bg-danger-soft text-danger border-danger/25"
    : "bg-attention-soft text-attention border-attention/25";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? ThumbsDown : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      <Icon className="size-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Draft message expander ───────────────────────────────────────────────────

function DraftMessage({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Mail className="size-3.5 text-muted-foreground" />
          {label}
        </span>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border bg-background px-4 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">{text}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Single PARE approval card ────────────────────────────────────────────────

function PAREApprovalCard({
  record,
  onApprove,
  onReject,
  busy,
}: {
  record: PAREApprovalRecord;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const { pareResult: r } = record;
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <PareApprovalHeader record={record} />
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3">
          <UserX className="size-4 shrink-0 text-danger mt-0.5" />
          <div>
            <p className="text-sm font-bold text-danger">Supplier withdrawn</p>
            <p className="text-xs text-danger mt-0.5">
              {r.withdrawnSupplier.name} · {formatPareTier(r.withdrawnSupplier.tier)} · {money.format(r.withdrawnSupplier.quotedAmount)}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PareRiskPanel assessment={r.riskAssessment} />
          <PareBudgetPanel analysis={r.budgetAnalysis} />
        </div>
        <PareReplacementPanel analysis={r.budgetAnalysis} />
        {r.candidates.length > 1 ? <PareOtherCandidates candidates={r.candidates} /> : null}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">AI-Drafted Messages</p>
          <div className="space-y-2">
            <DraftMessage label="Supplier notification (to replacement)" text={r.drafts.supplierNotification} />
            <DraftMessage label="Client reassurance (to event client)" text={r.drafts.clientReassurance} />
          </div>
        </div>
        <PareReviewFooter record={record} busy={busy} onApprove={onApprove} onReject={onReject} />
      </div>
    </div>
  );
}

function PareApprovalHeader({ record }: { record: PAREApprovalRecord }) {
  const r = record.pareResult;
  const mode = pareModeCopy(r.mode);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
          <Bot className="size-4" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">PARE · Emergency Replacement</p>
          <p className="text-xs text-muted-foreground">
            {r.withdrawnSupplier.name} · {r.withdrawnSupplier.category} · {new Date(r.triggeredAt).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${mode.className}`}>
          {mode.label}
        </span>
        <StatusPill status={record.status} />
      </div>
    </div>
  );
}

function PareRiskPanel({ assessment }: { assessment: PAREApprovalRecord["pareResult"]["riskAssessment"] }) {
  return (
    <div className={`rounded-xl border p-4 ${pareRiskColor(assessment.level)}`}>
      <div className="flex items-center gap-2 mb-2">
        {riskIcon(assessment.level)}
        <p className="text-sm font-black">{assessment.level} RISK</p>
      </div>
      <ul className="space-y-1">
        {assessment.factors.map((f, i) => (
          <li key={i} className="text-xs leading-5 opacity-90">· {f}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-semibold leading-5 border-t border-current/20 pt-2">
        {assessment.recommendation}
      </p>
    </div>
  );
}

function PareBudgetPanel({ analysis }: { analysis: PAREApprovalRecord["pareResult"]["budgetAnalysis"] }) {
  const tone = pareBudgetTone(analysis.feasible);
  return (
    <div className={`rounded-xl border p-4 ${tone.box}`}>
      <div className="flex items-center gap-2 mb-2">
        <PhilippinePeso className={`size-4 shrink-0 ${tone.icon}`} />
        <p className={`text-sm font-black ${tone.title}`}>{tone.label}</p>
      </div>
      <p className="text-xs leading-5 opacity-90">{analysis.summary}</p>
    </div>
  );
}

function PareReplacementPanel({ analysis }: { analysis: PAREApprovalRecord["pareResult"]["budgetAnalysis"] }) {
  const candidate = analysis.selectedCandidate;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Recommended Replacement</p>
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-foreground">{candidate.supplierName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{formatPareTier(candidate.tier)}</span>
              <span>·</span>
              <span>{money.format(candidate.quotedAmount)}</span>
              <span>·</span>
              <span>Reliability {Math.round(candidate.reliabilityScore * 100)}%</span>
              {candidate.halal ? <span className="text-success font-semibold">· Halal ✓</span> : null}
            </div>
          </div>
          <span className="text-sm font-black text-foreground">{analysis.costDeltaLabel}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{candidate.reason}</p>
      </div>
    </div>
  );
}

function PareOtherCandidates({ candidates }: { candidates: PAREApprovalRecord["pareResult"]["candidates"] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Other Candidates ({candidates.length - 1})</p>
      <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
        {candidates.slice(1).map((c) => (
          <div key={c.supplierId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div>
              <p className="text-xs font-bold text-foreground">{c.supplierName}</p>
              <p className="text-2xs text-muted-foreground">{formatPareTier(c.tier)} · Reliability {Math.round(c.reliabilityScore * 100)}%</p>
            </div>
            <span className="text-xs font-semibold text-foreground">{money.format(c.quotedAmount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PareReviewFooter({
  record,
  busy,
  onApprove,
  onReject,
}: {
  record: PAREApprovalRecord;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (record.status === "pending") {
    return (
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <ThumbsUp className="size-4" />
          Approve — confirm replacement
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold text-destructive transition hover:bg-danger-soft disabled:opacity-50"
        >
          <ThumbsDown className="size-4" />
          Reject
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 shrink-0" />
      <span>
        <span className="font-bold">{record.status === "approved" ? "Approved" : "Rejected"}</span>
        {record.reviewedBy ? ` by ${record.reviewedBy}` : ""}
        {record.reviewedAt ? ` · ${new Date(record.reviewedAt).toLocaleString()}` : ""}
      </span>
    </div>
  );
}

// ─── Main PARE panel ──────────────────────────────────────────────────────────

export function PAREPanel({
  eventId,
  assignedRequests,
  suppliers,
  onWithdraw,
  busy: parentBusy,
}: {
  eventId: string;
  assignedRequests: SupplierQuoteRequestRow[];
  suppliers: PrismSupplier[];
  onWithdraw: (requestId: string) => Promise<void>;
  busy: boolean;
}) {
  const {
    eventApprovals,
    loading,
    actionBusy,
    withdrawingId,
    error,
    fetchApprovals,
    handleWithdraw,
    handleApprove,
    handleReject,
  } = useParePanelViewModel({ eventId, onWithdraw });

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-white">
            <Zap className="size-4" />
          </span>
          <div>
            <p className="text-sm font-black text-foreground">PARE · Emergency Response Engine</p>
            <p className="text-xs text-muted-foreground">Withdraw an assigned supplier to trigger AI-powered replacement analysis</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchApprovals}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Assigned suppliers — withdraw triggers PARE */}
      {assignedRequests.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Assigned Suppliers</p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {assignedRequests.map((req) => {
              const supplier = suppliers.find((s) => s.id === req.supplierId);
              const tierLabel = supplier?.tier?.replace("tier_", "Tier ") ?? null;
              return (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Truck className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{req.supplierName ?? "Supplier"}</p>
                    <p className="text-xs text-muted-foreground">{req.category}{tierLabel ? ` · ${tierLabel}` : ""}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={parentBusy || withdrawingId === req.id}
                  onClick={() => handleWithdraw(req.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/25 bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger-soft disabled:opacity-50"
                >
                  <UserX className="size-3.5" />
                  {withdrawingId === req.id ? "Triggering PARE…" : "Withdraw · Trigger PARE"}
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {assignedRequests.length === 0 && eventApprovals.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted">
            <Bot className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">No assigned suppliers yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign a supplier quote above, then withdraw them here to trigger PARE.
          </p>
        </div>
      )}

      {/* PARE approval cards */}
      {eventApprovals.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground">
            {pareResultCountLabel(eventApprovals.length)}
          </p>
          {eventApprovals.map((record) => (
            <PAREApprovalCard
              key={record.id}
              record={record}
              onApprove={() => handleApprove(record.id)}
              onReject={() => handleReject(record.id)}
              busy={actionBusy}
            />
          ))}
        </div>
      )}

      {eventApprovals.length === 0 && assignedRequests.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <Bot className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold text-foreground">No PARE results yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click "Withdraw · Trigger PARE" on a supplier above to start.
          </p>
        </div>
      )}
    </div>
  );
}
