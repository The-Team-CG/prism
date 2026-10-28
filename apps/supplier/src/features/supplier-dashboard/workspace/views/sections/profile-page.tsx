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
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function ProfilePage({ supplier, session }: { supplier: PrismSupplier; session: PrismAuthenticatedSession }) {
  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Supplier profile</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary to-primary-deep text-xl font-black text-white">
              {supplier.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3 className="text-lg font-bold text-foreground">{supplier.name}</h3>
              <p className="text-sm text-muted-foreground">{supplier.categoryName}</p>
              <span className="mt-1 inline-block rounded-full bg-attention/10 px-2.5 py-0.5 text-xs font-bold capitalize text-attention">
                {fmt(supplier.tier)}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              { label: "Contact name", value: supplier.contactName || session.name },
              { label: "Email", value: supplier.email || session.email },
              { label: "Phone", value: supplier.phone || "—" },
              { label: "Member since", value: formatDate(supplier.applicationDate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Service inclusions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Service inclusions</h2>
          </div>
        </CardHeader>
        <CardBody>
          {supplier.serviceInclusions ? (
            <p className="text-sm leading-6 text-foreground">{supplier.serviceInclusions}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No service inclusions saved yet. PMCM manages your supplier record.</p>
          )}
        </CardBody>
      </Card>

      {/* Privacy notice */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">Supplier privacy boundary</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This portal shows only your assigned request records and your submitted quote. PMCM comparison, acceptable-range review, private ratings, and other supplier quotes remain private to the PMCM command app. Portal actions update your workspace for PMCM review only.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

