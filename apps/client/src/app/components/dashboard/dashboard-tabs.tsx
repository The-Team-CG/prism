"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type {
  MvpAuditLog,
  MvpBillingStatement,
  MvpBriefing,
  MvpDocument,
  MvpEvent,
  MvpPaymentMilestone,
} from "@/lib/mvp-api";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";

type DetailTab = "overview" | "floorplan" | "briefing" | "billing" | "documents" | "activity";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function SectionPanel({
  icon: Icon,
  title,
  children,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
            <Icon className="size-3.5" />
          </span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm not-last:border-b not-last:border-border">
      <span className="shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function ClientOverviewTab({
  selectedEvent,
  setTab,
}: {
  selectedEvent: MvpEvent;
  setTab: (tab: DetailTab) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionPanel icon={ClipboardList} title="Event overview">
        <div className="divide-y divide-border">
          <DataRow label="Event name" value={selectedEvent.eventName} />
          <DataRow label="Client" value={selectedEvent.clientName} />
          <DataRow label="Date" value={selectedEvent.eventDate ?? "—"} />
          <DataRow label="Status" value={<StatusBadge status={selectedEvent.status} />} />
          <DataRow label="Readiness" value={selectedEvent.readiness ?? "—"} />
          <DataRow
            label="Portal"
            value={<StatusBadge status={selectedEvent.clientPortalStatus} />}
          />
        </div>
      </SectionPanel>

      <SectionPanel icon={MapPinned} title="Floorplan checkpoint">
        <p className="text-sm leading-6 text-muted-foreground">
          Submit layout preferences first. When PMCM prepares the official version, this area becomes
          a read-only review space for approval or revision comments.
        </p>
        <Button
          onClick={() => setTab("floorplan")}
          className="mt-5 h-10 w-full rounded-lg font-bold"
        >
          Open floorplan <ArrowRight className="size-4" />
        </Button>
      </SectionPanel>
    </div>
  );
}

export function ClientBriefingTab({ briefing }: { briefing?: MvpBriefing }) {
  return (
    <SectionPanel icon={FileCheck2} title="Event briefing">
      {briefing ? (
        <div className="divide-y divide-border">
          <DataRow label="Venue" value={briefing.venue} />
          <DataRow label="Guest count" value={briefing.guestCount} />
          <DataRow label="Budget range" value={briefing.budgetRange} />
          <DataRow label="Services" value={briefing.serviceRequirements.join(", ")} />
        </div>
      ) : (
        <EmptyState
          icon={FileCheck2}
          title="No briefing yet"
          description="PMCM will publish the confirmed venue, schedule, pax, budget, and service notes here."
        />
      )}
    </SectionPanel>
  );
}

export function ClientBillingTab({
  payments,
  billing,
}: {
  payments: MvpPaymentMilestone[];
  billing?: MvpBillingStatement;
}) {
  return (
    <SectionPanel
      icon={WalletCards}
      title="Billing and payments"
      aside={
        billing ? (
          <span className="text-xs font-bold text-muted-foreground">
            {money.format(billing.totalAmount)} total
          </span>
        ) : undefined
      }
    >
      {billing && (
        <div className="mb-4 rounded-lg border border-border bg-secondary/60 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Statement</p>
          <p className="mt-1 text-sm font-bold text-foreground">{billing.number}</p>
          <StatusBadge status={billing.status} className="mt-2" />
        </div>
      )}
      {payments.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No payment milestones yet"
          description="Milestones appear after PMCM sends the billing statement linked to the approved proposal."
        />
      ) : (
        <div className="divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-4 py-3.5 text-sm">
              <div>
                <p className="font-bold text-foreground">{payment.label}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {payment.dueDate}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-bold text-foreground">{money.format(payment.amount)}</span>
                <StatusBadge status={payment.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export function ClientDocumentsTab({ documents }: { documents: MvpDocument[] }) {
  return (
    <SectionPanel icon={FileText} title="Documents and approvals">
      {documents.length === 0 ? (
        <EmptyState
          icon={LockKeyhole}
          title="No documents yet"
          description="Signed conforme files, billing statements, and client-visible approval documents will appear here."
        />
      ) : (
        <div className="divide-y divide-border">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <FileText className="size-3.5" />
                </span>
                <span className="truncate font-semibold text-foreground">{document.fileName}</span>
              </div>
              <StatusBadge status={document.status} />
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export function ClientActivityTab({ audit }: { audit: MvpAuditLog[] }) {
  return (
    <SectionPanel icon={Activity} title="Activity log">
      {audit.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Event changes and PMCM actions will appear here."
        />
      ) : (
        <div className="divide-y divide-border">
          {audit.map((item) => (
            <div key={item.id} className="flex gap-3 py-3.5 text-sm">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-(--prism-amber)">
                <Activity className="size-3.5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{item.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.actor}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}

export { CheckCircle2 };
