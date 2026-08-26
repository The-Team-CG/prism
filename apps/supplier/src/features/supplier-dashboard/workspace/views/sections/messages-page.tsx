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

export function MessagesPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Messages</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Direct communication with the PMCM team regarding your quote requests and assignments.</p>
      </CardHeader>
      <CardBody>
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="PMCM will send messages here regarding clarifications, revisions, and event-day coordination."
        />
      </CardBody>
    </Card>
  );
}

