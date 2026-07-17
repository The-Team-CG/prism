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
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierSession, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function SupportPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Supplier support</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contact the PMCM team for any portal issues, quote questions, or event concerns.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {[
            { title: "Quote submissions", body: "Submit your quote before the deadline shown on each request. Once PMCM closes or selects a request, editing is locked. Use the Requests section to submit or revise." },
            { title: "Assignment handoff", body: "After PMCM selects your quote, go to Bookings to confirm the assignment, save your contract filename, confirm readiness, and update event-day status." },
            { title: "Event day updates", body: "On the day of the event, use the Bookings section to mark Arrived, Set up and ready, and Done and leaving. These update your portal record for PMCM verification." },
            { title: "Payment inquiries", body: "Payment schedule and release is managed by PMCM billing. Check the Payments section for your selected quote amounts. Contact PMCM directly for payment timing." },
            { title: "Portal access issues", body: "If you cannot sign in or see incorrect data, contact your PMCM coordinator directly. Sample accounts: ops@xperto.test or flowers@bloom.test with password prism-supplier." },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

