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
import type { PrismApprovalRequest, PrismBillingStatement, PrismBriefing, PrismComplianceCheck, PrismDefenseReadiness, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismInquiry, PrismPmcmDashboardWorkspace, PrismPostEventDocument, PrismSupplierQuoteRequest } from "@prism/types";
import type { DashboardSection, DetailTab } from "../../model/event-dashboard-routing";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";
import { CommandStat } from "./command-stat";
import { EventQueueCard } from "./event-queue-card";
import type { EventFileHubItem } from "./event-file-types";


export function CommandHomePage({
  session,
  state,
  events,
  selectedEvent,
  unreviewedInquiries,
  pendingApprovals,
  defenseReadiness,
  onNavigateSection,
  onNavigateEvent,
  onReset,
}: {
  session: EventSession;
  state: PrismPmcmDashboardWorkspace;
  events: PrismEvent[];
  selectedEvent?: PrismEvent;
  unreviewedInquiries: number;
  pendingApprovals: PrismApprovalRequest[];
  defenseReadiness: PrismDefenseReadiness | null;
  onNavigateSection: (section: DashboardSection) => void;
  onNavigateEvent: (id: string, tab?: DetailTab) => void;
  onReset: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.name.split(" ")[0];

  const daysToEvent = (() => {
    if (!selectedEvent?.eventDate) return null;
    try {
      const diff = Math.ceil(
        (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff > 0 ? diff : 0;
    } catch { return null; }
  })();

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/70">P.R.I.S.M Event Command</p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                {greeting}, {firstName}.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                {events.length > 0
                  ? `${events.length} active event workspace${events.length === 1 ? "" : "s"}. ${unreviewedInquiries > 0 ? `${unreviewedInquiries} unreviewed inquiry${unreviewedInquiries === 1 ? "" : "s"} need attention.` : "No unreviewed inquiries."}`
                  : "No confirmed events yet. Accept an inquiry and upload the signed conforme to activate the first workspace."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90"
                  onClick={() => onNavigateSection("events-list")}
                >
                  <CalendarDays className="size-4" /> View events
                </Button>
                {unreviewedInquiries > 0 && (
                  <Button
                    variant="ghost"
                    className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                    onClick={() => onNavigateSection("inquiries")}
                  >
                    Review {unreviewedInquiries} inquiry{unreviewedInquiries === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </div>
            {daysToEvent !== null && (
              <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
                <span className="text-4xl font-black leading-none">{daysToEvent}</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
                {selectedEvent && (
                  <span className="mt-1 max-w-30 truncate text-[10px] text-white/60">{selectedEvent.eventName}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
        <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
      </div>

      {/* Command stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CommandStat
          label="Active events"
          value={events.length}
          icon={CalendarDays}
          accent="text-(--prism-signal)"
          onClick={() => onNavigateSection("events-list")}
        />
        <CommandStat
          label="Pending inquiries"
          value={unreviewedInquiries}
          icon={FileCheck2}
          accent="text-(--prism-amber)"
          onClick={() => onNavigateSection("inquiries")}
        />
        <CommandStat
          label="Pending approvals"
          value={pendingApprovals.length}
          icon={ShieldCheck}
          accent="text-(--prism-success)"
        />
      </div>

      {/* Events + approvals */}
      <div className={`grid gap-5 ${pendingApprovals.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <EventQueueCard
          events={events}
          selectedEventId={selectedEvent?.id}
          onSelectEvent={(id) => onNavigateEvent(id)}
          onReset={onReset}
          onNavigateEvent={(id) => onNavigateEvent(id, "overview")}
        />

        {pendingApprovals.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-(--prism-signal)" />
                <h3 className="text-sm font-bold text-foreground">Pending approvals</h3>
                <Badge className="ml-auto rounded-full bg-(--prism-amber-soft) px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">
                  {pendingApprovals.length}
                </Badge>
              </div>
            </CardHeader>
            <div className="divide-y divide-border">
              {pendingApprovals.slice(0, 3).map((req) => (
                <div key={req.id} className="px-6 py-3.5">
                  <p className="truncate text-sm font-bold text-foreground">{req.name}</p>
                  <p className="text-xs text-muted-foreground">{req.email} - {humanizeToken(req.role)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

