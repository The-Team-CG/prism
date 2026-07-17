"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";


export function ClientOverviewTab({
  selectedEvent,
  briefing,
  payments,
  billing,
  documents,
  audit,
  officialDraft,
  preferenceDraftCount,
  onOpenOfficialFloorplan,
  setTab,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  documents: PrismDocument[];
  audit: PrismAuditLog[];
  officialDraft?: PrismFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  const latestActivity = audit[0];
  const nextPayment = payments.find((p) => p.status !== "paid");
  const openMilestones = payments.filter((p) => p.status !== "paid").length;

  const daysToEvent = (() => {
    if (!selectedEvent.eventDate) return "—";
    try {
      const diff = Math.ceil(
        (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff > 0 ? `${diff}d` : "Today";
    } catch {
      return "—";
    }
  })();

  return (
    <div className="space-y-5">
      {/* Lifecycle strip */}
      <Card>
        <CardHeader>
          <SectionLabel>Event lifecycle</SectionLabel>
          <h2 className="mt-1 text-base font-bold text-foreground">Planning progress</h2>
        </CardHeader>
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Inquiry accepted", state: "done" },
              { label: "Conforme signed", state: selectedEvent.clientPortalStatus === "unlocked" ? "done" : "pending" },
              { label: "Briefing / proposal", state: briefing && billing ? "done" : "current" },
              { label: "Planning", state: officialDraft?.status === "approved" ? "done" : "current" },
              { label: "Event day", state: "pending" },
              { label: "Closure", state: "pending" },
            ].map((step, i) => (
              <div
                key={step.label}
                className={`rounded-lg px-3 py-2.5 text-sm ${
                  step.state === "done"
                    ? "bg-(--prism-success)/10 border border-(--prism-success)/20"
                    : step.state === "current"
                      ? "bg-(--prism-signal-soft) border border-(--prism-signal)/20"
                      : "bg-muted/40 border border-border"
                }`}
              >
                <p className="text-[10px] font-bold text-muted-foreground">Step {i + 1}</p>
                <p className={`mt-1 text-xs font-bold ${
                  step.state === "done" ? "text-(--prism-success)"
                  : step.state === "current" ? "text-(--prism-signal)"
                  : "text-muted-foreground"
                }`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Days to event", value: daysToEvent, icon: Timer, color: "text-(--prism-signal)" },
          { label: "Open milestones", value: openMilestones || "0", icon: WalletCards, color: "text-(--prism-amber)" },
          { label: "Documents on file", value: documents.length || "0", icon: FileText, color: "text-(--prism-success)" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted ${stat.color}`}>
              <stat.icon className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-black leading-none text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-col: event details + layout checkpoint */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Event details</h3>
            </div>
          </CardHeader>
          <CardBody className="py-2">
            <DataRow label="Event name" value={selectedEvent.eventName} />
            <DataRow label="Primary contact" value={selectedEvent.clientName} />
            <DataRow label="Date" value={selectedEvent.eventDate ?? "Pending"} />
            <DataRow label="Status" value={<StatusBadge status={selectedEvent.status} />} />
            <DataRow label="Readiness" value={selectedEvent.readiness ?? "Pending"} />
            <DataRow
              label="Portal access"
              value={
                <StatusBadge
                  status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                  label={portalStatusLabel(selectedEvent.clientPortalStatus)}
                />
              }
            />
            <DataRow label="Venue" value={briefing?.venue ?? "To be confirmed"} />
            <DataRow label="Guests" value={briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          {/* Layout checkpoint */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPinned className="size-4 text-(--prism-signal)" />
                  <h3 className="text-sm font-bold text-foreground">Floor plan</h3>
                </div>
                {officialDraft && <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} />}
              </div>
            </CardHeader>
            <CardBody className="py-2">
              <DataRow label="Preference drafts" value={preferenceDraftCount || "None yet"} />
              <DataRow label="Official layout" value={officialDraft ? formatLabel(officialDraft.status) : "Not published"} />
              <DataRow label="Last update" value={officialDraft?.updatedAt ?? "—"} />
            </CardBody>
            <div className="px-6 pb-5">
              <Button
                className="w-full rounded-xl font-bold"
                onClick={officialDraft && onOpenOfficialFloorplan ? onOpenOfficialFloorplan : () => setTab("floorplan")}
              >
                {officialDraft ? "Open floor plan" : "Set layout preferences"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>

          {/* Next payment */}
          {(billing || nextPayment) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ReceiptText className="size-4 text-(--prism-amber)" />
                  <h3 className="text-sm font-bold text-foreground">Next payment</h3>
                </div>
              </CardHeader>
              <CardBody className="py-2">
                {nextPayment ? (
                  <>
                    <DataRow label="Milestone" value={nextPayment.label} />
                    <DataRow label="Due" value={nextPayment.dueDate} />
                    <DataRow label="Amount" value={money.format(nextPayment.amount)} />
                  </>
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">All milestones settled.</p>
                )}
              </CardBody>
              <div className="px-6 pb-5">
                <Button variant="outline" className="w-full rounded-xl font-semibold" onClick={() => setTab("billing")}>
                  View billing
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent activity */}
      {(documents.length > 0 || latestActivity) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Recent activity</h3>
            </div>
          </CardHeader>
          <CardBody className="py-2">
            <DataRow label="Documents on file" value={`${documents.length} file${documents.length === 1 ? "" : "s"}`} />
            {latestActivity && (
              <>
                <DataRow label="Latest update" value={clientActivityTitle(latestActivity.action)} />
                <DataRow label="Updated by" value={`${clientActivityActor(latestActivity.actor)} — ${latestActivity.createdAt}`} />
              </>
            )}
          </CardBody>
          <div className="flex gap-2 px-6 pb-5">
            <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => setTab("documents")}>
              Documents
            </Button>
            <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => setTab("activity")}>
              Activity log
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
