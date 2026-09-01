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
import { formatShortDate, humanizeToken } from "@/features/pmcm-kit/model/formatters";
import type { EventSession } from "@/app/lib/session";
import type { PrismApprovalRequest, PrismBillingStatement, PrismBriefing, PrismComplianceCheck, PrismDefenseReadiness, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismInquiry, PrismPmcmDashboardWorkspace, PrismPostEventDocument, PrismSupplierQuoteRequest } from "@prism/types";
import type { DashboardSection, DetailTab } from "../../model/event-dashboard-routing";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";
import type { EventFileHubItem } from "./event-file-types";


export function EventFileThumbnail({ item, active }: { item: EventFileHubItem; active: boolean }) {
  if (item.kind === "floorplan") {
    return (
      <div className="relative h-28 overflow-hidden rounded-md border border-border bg-[#fff8f2]">
        <div className="absolute inset-0 bg-[linear-gradient(#eadbd3_1px,transparent_1px),linear-gradient(90deg,#eadbd3_1px,transparent_1px)] bg-size-[18px_18px]" />
        <div className="absolute left-4 top-4 h-14 w-24 rounded-sm border border-primary/30 bg-primary/10" />
        <div className="absolute bottom-4 right-4 grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="size-3 rounded-full bg-(--prism-success)/55" />
          ))}
        </div>
        <div className="absolute bottom-3 left-4 h-2 w-20 rounded-full bg-(--prism-amber)/70" />
      </div>
    );
  }

  return (
    <div className="h-28 overflow-hidden rounded-md border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`h-2 w-14 rounded-full ${item.accent}`} />
          <div className="mt-3 h-2 w-24 rounded-full bg-muted" />
          <div className="mt-2 h-2 w-16 rounded-full bg-muted" />
        </div>
        <div className="h-9 w-12 rounded-sm border border-border bg-muted/40" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="h-2 rounded-full bg-muted" />
        <div className="h-2 rounded-full bg-muted" />
        <div className="h-2 rounded-full bg-muted" />
      </div>
      <div className={active ? "mt-4 h-1 rounded-full bg-primary" : "mt-4 h-1 rounded-full bg-muted"} />
    </div>
  );
}

