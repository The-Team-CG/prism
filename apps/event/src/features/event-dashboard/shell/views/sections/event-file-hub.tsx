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
import { EventFileThumbnail } from "./event-file-thumbnail";
import { EventFilePreview } from "./event-file-preview";


export function EventFileHub({
  event,
  documents,
  drafts,
  billingStatements,
  quoteRequests,
  briefing,
  checks,
  postEventDocuments,
  onOpenFloorplans,
  onOpenBriefing,
  onOpenSuppliers,
  onOpenBilling,
  onOpenClosure,
}: {
  event: PrismEvent;
  documents: PrismDocument[];
  drafts: PrismFloorPlanDraft[];
  billingStatements: PrismBillingStatement[];
  quoteRequests: PrismSupplierQuoteRequest[];
  briefing?: PrismBriefing;
  checks: PrismComplianceCheck[];
  postEventDocuments: PrismPostEventDocument[];
  onOpenFloorplans: () => void;
  onOpenBriefing: () => void;
  onOpenSuppliers: () => void;
  onOpenBilling: () => void;
  onOpenClosure: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const items = useMemo<EventFileHubItem[]>(() => {
    const uploaded = documents.map((document) => ({
      id: `document-${document.id}`,
      title: document.fileName,
      subtitle: "Uploaded file",
      category: humanizeToken(document.type),
      status: humanizeToken(document.status),
      date: formatShortDate(document.uploadedAt),
      owner: event.clientName,
      extension: document.fileName.split(".").pop()?.toUpperCase() || "FILE",
      kind: "document" as const,
      meta: `Document ${document.id}`,
      accent: "bg-primary",
    }));

    const floorplans = drafts.map((draft) => ({
      id: `floorplan-${draft.id}`,
      title: `${draft.name}.floorplan`,
      subtitle: "Official layout",
      category: "Floorplans",
      status: humanizeToken(draft.status),
      date: formatShortDate(draft.approvedAt ?? draft.submittedAt ?? draft.updatedAt),
      owner: draft.createdByRole ? humanizeToken(draft.createdByRole) : "PMCM",
      extension: "PLAN",
      kind: "floorplan" as const,
      meta: `Floor plan ${draft.floorPlanId}`,
      accent: "bg-(--prism-success)",
    }));

    const invoices = billingStatements.map((statement) => ({
      id: `billing-${statement.id}`,
      title: `Billing Statement ${statement.number}.pdf`,
      subtitle: "Invoice PDF",
      category: "Billing",
      status: humanizeToken(statement.status),
      date: formatShortDate(statement.sentAt ?? statement.generatedAt),
      owner: statement.clientName || event.clientName,
      extension: "PDF",
      kind: "invoice" as const,
      meta: statement.number,
      amount: statement.totalAmount,
      accent: "bg-(--prism-amber)",
    }));

    const contracts = quoteRequests
      .filter((request) => request.contractDocumentId || request.assignmentStatus)
      .map((request) => ({
        id: `contract-${request.id}`,
        title: `${request.supplierName} Contract.pdf`,
        subtitle: request.category,
        category: "Supplier Contracts",
        status: humanizeToken(request.assignmentStatus ?? request.status),
        date: formatShortDate(request.createdAt),
        owner: request.supplierName,
        extension: "PDF",
        kind: "contract" as const,
        meta: request.contractDocumentId ?? request.id,
        accent: "bg-[#13a8a0]",
      }));

    const generated = [
      briefing
        ? {
            id: "briefing-file",
            title: `${event.eventName} Briefing.pdf`,
            subtitle: "Event dossier",
            category: "Briefing",
            status: "Submitted",
            date: formatShortDate(briefing.submittedAt),
            owner: event.clientName,
            extension: "PDF",
            kind: "briefing" as const,
            meta: briefing.venue,
            accent: "bg-primary",
          }
        : null,
      checks.length
        ? {
            id: "closeout-checks",
            title: `${event.eventName} Closeout Checks.pdf`,
            subtitle: "Compliance report",
            category: "Closeout",
            status: `${checks.filter((check) => check.status === "open").length} open`,
            date: formatShortDate(checks[0]?.resolvedAt),
            owner: "PMCM",
            extension: "PDF",
            kind: "closeout" as const,
            meta: `${checks.length} checks`,
            accent: "bg-[#64748b]",
          }
        : null,
      ...postEventDocuments.map((document) => ({
        id: `post-event-${document.id}`,
        title: `${document.title}.pdf`,
        subtitle: "Post-event document",
        category: "Closeout",
        status: humanizeToken(document.status),
        date: event.eventDate,
        owner: "PMCM",
        extension: "PDF",
        kind: "closeout" as const,
        meta: document.id,
        accent: "bg-[#64748b]",
      })),
    ].filter(Boolean) as EventFileHubItem[];

    return [...invoices, ...floorplans, ...uploaded, ...contracts, ...generated];
  }, [billingStatements, briefing, checks, documents, drafts, event, postEventDocuments, quoteRequests]);

  const filteredItems = items.filter((item) => {
    const haystack = `${item.title} ${item.category} ${item.owner} ${item.status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];

  useEffect(() => {
    if (!selected && selectedId) setSelectedId(null);
    if (selected && selected.id !== selectedId && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(selected.id);
    }
  }, [filteredItems, selected, selectedId]);

  function openSelected() {
    if (!selected) return;
    if (selected.kind === "floorplan") onOpenFloorplans();
    else if (selected.kind === "briefing") onOpenBriefing();
    else if (selected.kind === "contract") onOpenSuppliers();
    else if (selected.kind === "invoice") onOpenBilling();
    else if (selected.kind === "closeout") onOpenClosure();
  }

  if (!items.length) {
    return <EmptyState icon={FileText} title="No files yet" description="Documents will appear after briefing, floorplan, supplier, billing, or closeout records are created." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid min-h-[760px] lg:grid-cols-[25rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-foreground">{filteredItems.length} results</p>
              <div className="flex rounded-md border border-border bg-background p-0.5">
                <button type="button" data-active={view === "grid"} onClick={() => setView("grid")} className="grid size-7 place-items-center rounded-sm text-muted-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary" aria-label="Grid view">
                  <Grid2X2 className="size-3.5" />
                </button>
                <button type="button" data-active={view === "list"} onClick={() => setView("list")} className="grid size-7 place-items-center rounded-sm text-muted-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary" aria-label="List view">
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" placeholder="Search event files..." />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-black text-background"><Share2 className="size-3.5" /> Share Selected</button>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Download className="size-3.5" /> Download</button>
              <button type="button" onClick={openSelected} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Eye className="size-3.5" /> Open</button>
              <button type="button" className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground" aria-label="More file actions"><MoreHorizontal className="size-3.5" /></button>
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-black text-foreground">Relevance</p>
            <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
              {filteredItems.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-active={active}
                    onClick={() => setSelectedId(item.id)}
                    className={view === "grid" ? "group min-w-0 rounded-lg border border-transparent bg-background p-2 text-left transition hover:border-primary/20 data-[active=true]:border-primary data-[active=true]:bg-primary/5" : "group flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent bg-background p-2 text-left transition hover:border-primary/20 data-[active=true]:border-primary data-[active=true]:bg-primary/5"}
                  >
                    {view === "grid" ? (
                      <EventFileThumbnail item={item} active={active} />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-white text-[10px] font-black text-primary">{item.extension}</span>
                    )}
                    <span className={view === "grid" ? "mt-2 block min-w-0" : "block min-w-0 flex-1"}>
                      <span className="block truncate text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.extension} - {item.owner}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {selected ? (
          <div className="min-w-0 bg-background">
            <div className="border-b border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-foreground">{selected.title}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{selected.extension} - {selected.category} - {selected.date}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground">Share</button>
                  <button type="button" onClick={openSelected} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground">Open</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Pencil className="size-3.5" /> Edit PDF</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Download className="size-3.5" /> Download</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><FileSignature className="size-3.5" /> Self-Sign</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><MessageSquareText className="size-3.5" /> Comment</button>
                <button type="button" className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground" aria-label="More preview actions"><MoreHorizontal className="size-3.5" /></button>
                <button type="button" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary"><Upload className="size-3.5" /> Upload new version</button>
              </div>
            </div>
            <EventFilePreview event={event} item={selected} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

