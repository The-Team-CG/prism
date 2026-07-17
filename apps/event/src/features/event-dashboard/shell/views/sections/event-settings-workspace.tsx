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
import type { EventFileHubItem } from "./event-file-types";


export function EventSettingsWorkspace({ session, selectedEvent }: { session: EventSession; selectedEvent?: PrismEvent }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        { label: "Signed in as", value: session.name, detail: humanizeToken(session.role) },
        { label: "Default workspace", value: selectedEvent?.eventName ?? "No event selected", detail: selectedEvent?.clientName ?? "Pick an event from Events." },
        { label: "Notifications", value: "Email + Viber", detail: "Production adapters are still gated by notification infrastructure." },
      ].map((item) => (
        <Card key={item.label}>
          <CardBody>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </CardBody>
        </Card>
      ))}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-black text-foreground">Workspace controls</h2>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          {["Role-safe access", "Audit logging", "Client portal gating"].map((item) => (
            <div key={item} className="rounded-md border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-black text-foreground">{item}</p>
              <p className="mt-1 text-xs text-muted-foreground">Managed by PMCM event command policy.</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

