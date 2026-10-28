"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
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

export function SupportPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Supplier support</h2>
          <p className="mt-1 text-sm text-muted-foreground">Contact the PMCM team for any portal issues, quote questions, or event concerns.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {[
            { title: "Quote submissions", body: "Submit your quote before the deadline shown on each request. Once PMCM closes or selects a request, editing is locked. Use the Requests section to submit or revise." },
            { title: "Assignment handoff", body: "After PMCM selects your quote, go to Bookings to confirm the assignment, upload your signed contract for review, confirm readiness, and update event-day status." },
            { title: "Event day updates", body: "On the day of the event, use the Bookings section to mark Arrived, Set up and ready, and Done and leaving. These update your portal record for PMCM verification." },
            { title: "Payment inquiries", body: "Payment schedule and release is managed by PMCM billing. Check the Payments section for your selected quote amounts. Contact PMCM directly for payment timing." },
          ].map(({ title, body }) => (
            <div key={title} className="border-b border-border pb-4 last:border-b-0">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Portal access issues</h3>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="supplier portal access" fallback="If you cannot sign in or see incorrect data, contact your PMCM coordinator directly." />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

