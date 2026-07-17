"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Grid2X2,
  LayoutGrid,
  List,
  MapPinned,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Badge } from "@/app/components/ui/badge";
import { formatShortDate, humanizeToken } from "@/features/event-ops";
import type { EventSession } from "@/app/lib/session";
import type {
  PrismApprovalRequest,
  PrismBillingStatement,
  PrismBriefing,
  PrismComplianceCheck,
  PrismDefenseReadiness,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismInquiry,
  PrismPmcmDashboardWorkspace,
  PrismPostEventDocument,
  PrismSupplierQuoteRequest,
} from "@/lib/prism-api";
import type { DashboardSection, DetailTab } from "../../model/event-dashboard-routing";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";
import type { EventFileHubItem } from "./event-file-types";


export function EventTasksWorkspace({
  unreviewedInquiries,
  pendingApprovals,
  selectedEvent,
  defenseReadiness,
  draftsCount,
  quoteCount,
  paymentCount,
  openCheckCount,
  onNavigateSection,
  onNavigateEventTab,
}: {
  unreviewedInquiries: number;
  pendingApprovals: PrismApprovalRequest[];
  selectedEvent?: PrismEvent;
  defenseReadiness: PrismDefenseReadiness | null;
  draftsCount: number;
  quoteCount: number;
  paymentCount: number;
  openCheckCount: number;
  onNavigateSection: (section: DashboardSection) => void;
  onNavigateEventTab: (tab: DetailTab) => void;
}) {
  const tasks = [
    {
      id: "inquiries",
      label: "Review client inquiries",
      detail: `${unreviewedInquiries} inquiry item(s) need PMCM review.`,
      count: unreviewedInquiries,
      action: () => onNavigateSection("inquiries"),
    },
    {
      id: "approvals",
      label: "Approve portal accounts",
      detail: `${pendingApprovals.length} pending access request(s).`,
      count: pendingApprovals.length,
      action: () => onNavigateSection("clients"),
    },
    {
      id: "floorplans",
      label: "Check floorplan drafts",
      detail: selectedEvent ? `${draftsCount} draft(s) for ${selectedEvent.eventName}.` : "Select an event workspace.",
      count: draftsCount,
      action: () => onNavigateEventTab("floorplans"),
    },
    {
      id: "suppliers",
      label: "Review supplier coverage",
      detail: selectedEvent ? `${quoteCount} supplier quote(s) linked to the event.` : "Select an event workspace.",
      count: quoteCount,
      action: () => onNavigateEventTab("suppliers"),
    },
    {
      id: "billing",
      label: "Check billing milestones",
      detail: selectedEvent ? `${paymentCount} payment milestone(s) to monitor.` : "Select an event workspace.",
      count: paymentCount,
      action: () => onNavigateEventTab("billing"),
    },
    {
      id: "closure",
      label: "Resolve closeout gates",
      detail: selectedEvent ? `${openCheckCount} open closeout check(s).` : "Select an event workspace.",
      count: openCheckCount,
      action: () => onNavigateEventTab("closure"),
    },
  ];
  const nextActions = defenseReadiness?.nextActions ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-black text-foreground">Task queue</h2>
          </div>
        </CardHeader>
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <button key={task.id} type="button" onClick={task.action} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-muted/30">
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground">{task.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{task.detail}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{task.count}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-black text-foreground">Event next actions</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {nextActions.length ? nextActions.slice(0, 5).map((action) => (
            <div key={action.key} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-xs font-black text-foreground">{action.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
            </div>
          )) : (
            <EmptyState icon={CheckCircle2} title="No open blockers" description="The selected event has no current readiness action items." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

