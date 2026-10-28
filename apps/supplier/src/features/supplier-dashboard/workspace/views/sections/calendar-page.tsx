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
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function CalendarPage({ workspace }: { workspace: SupplierWorkspace; quoteByRequest: Map<string, PrismSupplierQuote> }) {
  const events = useMemo(() => buildCalendarEvents(workspace), [workspace]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Upcoming deadlines &amp; dates</h2>
          </div>
        </CardHeader>
        {events.length === 0 ? (
          <CardBody>
            <EmptyState icon={CalendarDays} title="No upcoming dates." description="Quote deadlines and event dates will appear here." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev, i) => {
              const past = ev.date < today;
              const isToday = ev.date === today;
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center ${isToday ? "bg-primary text-white" : past ? "bg-muted text-muted-foreground" : "bg-muted/50 text-foreground"}`}>
                    <span className="text-xs font-medium leading-none">{new Date(ev.date + "T00:00:00").toLocaleString("en-PH", { month: "short" })}</span>
                    <span className="text-lg font-black leading-tight">{new Date(ev.date + "T00:00:00").getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${past ? "text-muted-foreground line-through" : "text-foreground"}`}>{ev.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{isToday ? "Today" : past ? "Past" : formatDate(ev.date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-3xs font-bold ${ev.type === "deadline" ? (past ? "bg-muted text-muted-foreground" : "bg-attention/10 text-attention") : "bg-success/10 text-success"}`}>
                    {ev.type === "deadline" ? "Quote deadline" : "Event day"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

