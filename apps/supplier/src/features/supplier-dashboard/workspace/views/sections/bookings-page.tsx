"use client";

import { FormEvent, useMemo } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PrismDashboardShell } from "@prism/ui";
import {
  EVENT_STATUS_ACTIONS,
  buildBookingSteps,
  buildCalendarEvents,
  closedRequestReason,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  readinessTone,
} from "../../model/supplier-workspace-rules";
import type {
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  QuoteFormState,
  SupplierDashboardSection,
  SupplierSession,
  SupplierWorkspace,
} from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function BookingsPage({
  selectedRequests, session, readinessNotes, contractFiles, statusNotes, busy,
  onReadinessNoteChange, onContractFileChange, onStatusNoteChange,
  onConfirmAssignment, onConfirmReadiness, onSaveContract, onUpdateStatus,
}: {
  selectedRequests: PrismSupplierQuoteRequest[];
  session: SupplierSession;
  readinessNotes: Record<string, string>;
  contractFiles: Record<string, string>;
  statusNotes: Record<string, string>;
  busy: string | null;
  onReadinessNoteChange: (id: string, v: string) => void;
  onContractFileChange: (id: string, v: string) => void;
  onStatusNoteChange: (id: string, v: string) => void;
  onConfirmAssignment: (req: PrismSupplierQuoteRequest) => void;
  onConfirmReadiness: (req: PrismSupplierQuoteRequest) => void;
  onSaveContract: (req: PrismSupplierQuoteRequest) => void;
  onUpdateStatus: (req: PrismSupplierQuoteRequest, status: string) => void;
}) {
  if (!selectedRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={BadgeCheck} title="No active bookings." description="When PMCM selects your quote, the booking appears here for handoff." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-5">
      {selectedRequests.map((req) => {
        const steps = buildBookingSteps(req);

        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionAccent>Selected booking</SectionAccent>
                  <h3 className="mt-1 text-sm font-bold text-foreground">{req.category}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{req.message}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)">
                  <BadgeCheck className="size-3" /> Selected
                </Badge>
              </div>
            </CardHeader>

            {/* Progress */}
            <div className="grid grid-cols-2 gap-3 border-b border-border px-6 py-5 sm:grid-cols-4">
              {steps.map((step) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${step.done ? "bg-(--prism-success) text-white" : "border-2 border-border bg-background"}`}>
                    {step.done ? <CheckCircle2 className="size-3" /> : <Circle className="size-3 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${step.done ? "text-(--prism-success)" : "text-muted-foreground"}`}>{step.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{step.meta}</p>
                  </div>
                </div>
              ))}
            </div>

            <CardBody className="space-y-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">1. Confirm assignment</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Acknowledge that you accept this assignment from PMCM.</p>
                <Button type="button" size="sm" variant={req.assignmentStatus === "confirmed" ? "outline" : "default"}
                  disabled={req.assignmentStatus === "confirmed" || busy === `${req.id}:assignment`}
                  onClick={() => onConfirmAssignment(req)} className="mt-3 rounded-xl font-bold">
                  <CheckCircle2 className="size-4" />
                  {req.assignmentStatus === "confirmed" ? "Assignment confirmed" : "Confirm assignment"}
                </Button>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">2. Readiness &amp; contract</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Confirm readiness and save your contract filename for PMCM records.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Readiness notes
                    <Input value={readinessNotes[req.id] ?? req.readinessNotes ?? ""} onChange={(e) => onReadinessNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Setup constraints or no concerns" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Contract filename
                    <Input value={contractFiles[req.id] ?? "supplier-contract.pdf"} onChange={(e) => onContractFileChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="supplier-contract.pdf" />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={req.readinessStatus === "confirmed" ? "outline" : "default"}
                    disabled={req.readinessStatus === "confirmed" || busy === `${req.id}:readiness`}
                    onClick={() => onConfirmReadiness(req)} className="rounded-xl font-bold">
                    <PackageCheck className="size-4" />{req.readinessStatus === "confirmed" ? "Readiness confirmed" : "Confirm readiness"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy === `${req.id}:contract`} onClick={() => onSaveContract(req)} className="rounded-xl font-bold">
                    <FileText className="size-4" /> Save contract
                  </Button>
                </div>
              </div>

              {/* Step 3 — event day */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">3. Event day status</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Tap to update your onsite status for PMCM verification.</p>
                <label className="mt-3 grid gap-1.5 text-sm font-bold text-foreground">
                  Status note
                  <Input value={statusNotes[req.id] ?? req.eventDayNotes ?? ""} onChange={(e) => onStatusNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Optional note for PMCM" />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {EVENT_STATUS_ACTIONS.map(({ status, label, helper }) => (
                    <button key={status} type="button" disabled={busy === `${req.id}:${status}`} onClick={() => onUpdateStatus(req, status)}
                      className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 font-bold transition ${req.eventDayStatus === status ? "border-(--prism-signal) bg-(--prism-signal) text-white" : "border-border bg-card text-foreground hover:border-(--prism-signal)/40 hover:bg-muted/40"}`}>
                      <Truck className="size-5" />
                      <span className="text-sm">{label}</span>
                      <span className="text-[11px] font-semibold opacity-70">{helper}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

