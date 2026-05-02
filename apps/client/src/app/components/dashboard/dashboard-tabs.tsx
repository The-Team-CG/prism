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
  MvpFloorPlanDraft,
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

function formatLabel(value?: string) {
  if (!value) return "Pending";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bPmcm\b/g, "Event Team");
}

function portalStatusLabel(status: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

function portalBadgeStatus(status: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

function clientActivityTitle(action: string) {
  if (/created demo event workspace/i.test(action)) return "Opened event workspace";
  return action
    .replaceAll("_", " ")
    .replace(/\bPMCM Admin\b/gi, "Event team")
    .replace(/\bPMCM\b/gi, "Event team")
    .replace(/\bAdmin\b/gi, "team");
}

function clientActivityActor(actor: string) {
  return /pmcm|admin/i.test(actor) ? "Event team" : actor;
}

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
    <div className="grid gap-1 py-2.5 text-sm not-last:border-b not-last:border-border sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="break-words font-semibold text-foreground sm:text-right">{value}</span>
    </div>
  );
}

export function ClientOverviewTab({
  selectedEvent,
  briefing,
  payments,
  billing,
  documents,
  audit,
  officialDraft,
  preferenceDraftCount,
  onOpenOfficialFloorplan,
  setTab,
}: {
  selectedEvent: MvpEvent;
  briefing?: MvpBriefing;
  payments: MvpPaymentMilestone[];
  billing?: MvpBillingStatement;
  documents: MvpDocument[];
  audit: MvpAuditLog[];
  officialDraft?: MvpFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  const latestActivity = audit[0];
  const nextPayment = payments.find((payment) => payment.status !== "paid") ?? payments[0];
  const portalOpen = selectedEvent.clientPortalStatus === "unlocked";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-secondary/60 px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary">
              {portalOpen ? <CheckCircle2 className="size-4" /> : <LockKeyhole className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">
                {portalOpen ? "Signed conforme gate cleared" : "Portal access is still locked"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {portalOpen
                  ? "This event is confirmed. Briefing, billing, documents, preference drafts, and official layout review stay tied to this record."
                  : "The client portal opens after the inquiry is accepted and the signed conforme is uploaded."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="min-h-11 w-full rounded-lg font-bold sm:w-auto"
            onClick={() => setTab("documents")}
          >
            View conforme files
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionPanel icon={ClipboardList} title="Event overview">
          <div className="divide-y divide-border">
            <DataRow label="Event name" value={selectedEvent.eventName} />
            <DataRow label="Primary contact" value={selectedEvent.clientName} />
            <DataRow label="Date" value={selectedEvent.eventDate ?? "Pending"} />
            <DataRow label="Event status" value={<StatusBadge status={selectedEvent.status} />} />
            <DataRow label="Readiness" value={selectedEvent.readiness ?? "Pending"} />
            <DataRow
              label="Conforme gate"
              value={
                <StatusBadge
                  status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                  label={portalStatusLabel(selectedEvent.clientPortalStatus)}
                />
              }
            />
            <DataRow label="Venue" value={briefing?.venue ?? "To be confirmed"} />
            <DataRow
              label="Guest count"
              value={briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"}
            />
          </div>
        </SectionPanel>

        <SectionPanel
          icon={MapPinned}
          title="Layout checkpoint"
          aside={
            officialDraft ? (
              <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} />
            ) : undefined
          }
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Preference drafts are separate from the official floorplan. When the official version is published,
            this becomes a read-only review space for approval or revision comments.
          </p>
          <div className="mt-3 divide-y divide-border">
            <DataRow label="Preference drafts" value={preferenceDraftCount || "None yet"} />
            <DataRow label="Official layout" value={officialDraft ? formatLabel(officialDraft.status) : "Not published"} />
            <DataRow label="Last update" value={officialDraft?.updatedAt ?? "Pending"} />
          </div>
          <Button
            onClick={officialDraft && onOpenOfficialFloorplan ? onOpenOfficialFloorplan : () => setTab("floorplan")}
            className="mt-5 min-h-11 w-full rounded-lg font-bold"
          >
            {officialDraft ? "View read-only plan" : "Open layout preferences"} <ArrowRight className="size-4" />
          </Button>
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel
          icon={WalletCards}
          title="Billing milestones"
          aside={
            billing ? (
              <span className="text-xs font-bold text-muted-foreground">
                {money.format(billing.totalAmount)} total
              </span>
            ) : undefined
          }
        >
          {billing || nextPayment ? (
            <div className="divide-y divide-border">
              {billing ? (
                <>
                  <DataRow label="Statement" value={billing.number} />
                  <DataRow label="Statement status" value={<StatusBadge status={billing.status} />} />
                </>
              ) : null}
              {nextPayment ? (
                <>
                  <DataRow label="Next milestone" value={nextPayment.label} />
                  <DataRow label="Due date" value={nextPayment.dueDate} />
                  <DataRow label="Amount" value={money.format(nextPayment.amount)} />
                </>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No milestones yet"
              description="Payment milestones appear after the billing statement is posted."
            />
          )}
          <Button
            variant="outline"
            onClick={() => setTab("billing")}
            className="mt-4 min-h-11 w-full rounded-lg font-bold sm:w-auto"
          >
            Open billing
          </Button>
        </SectionPanel>

        <SectionPanel icon={FileText} title="Documents and activity">
          {documents.length || latestActivity ? (
            <div className="divide-y divide-border">
              <DataRow label="Documents" value={`${documents.length} file${documents.length === 1 ? "" : "s"}`} />
              <DataRow
                label="Latest update"
                value={latestActivity ? clientActivityTitle(latestActivity.action) : "No activity yet"}
              />
              {latestActivity ? (
                <DataRow
                  label="Updated by"
                  value={`${clientActivityActor(latestActivity.actor)} - ${latestActivity.createdAt}`}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents or updates yet"
              description="Files, approvals, and event updates appear here as planning moves forward."
            />
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => setTab("documents")}
              className="min-h-11 rounded-lg font-bold"
            >
              Open documents
            </Button>
            <Button
              variant="outline"
              onClick={() => setTab("activity")}
              className="min-h-11 rounded-lg font-bold"
            >
              Open activity
            </Button>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

export function ClientBriefingTab({ briefing }: { briefing?: MvpBriefing }) {
  return (
    <SectionPanel icon={FileCheck2} title="Event briefing">
      {briefing ? (
        <div className="divide-y divide-border">
          <DataRow label="Venue" value={briefing.venue} />
          <DataRow label="Guest count" value={`${briefing.guestCount} guests`} />
          <DataRow label="Budget range" value={briefing.budgetRange} />
          <DataRow label="Services" value={briefing.serviceRequirements.join(", ")} />
        </div>
      ) : (
        <EmptyState
          icon={FileCheck2}
          title="No briefing yet"
          description="The confirmed venue, schedule, guest count, budget, and service notes will appear here."
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
      title="Billing milestones"
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
          <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Billing statement</p>
          <p className="mt-1 text-sm font-bold text-foreground">{billing.number}</p>
          <StatusBadge status={billing.status} label={formatLabel(billing.status)} className="mt-2" />
        </div>
      )}
      {payments.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No payment milestones yet"
          description="Milestones appear after the billing statement linked to the approved proposal is posted."
        />
      ) : (
        <div className="divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.id} className="flex flex-col gap-3 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-bold text-foreground">{payment.label}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {payment.dueDate}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="text-sm font-bold text-foreground">{money.format(payment.amount)}</span>
                <StatusBadge status={payment.status} label={formatLabel(payment.status)} />
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
          description="Signed conforme files, billing statements, and approval documents for this event will appear here."
        />
      ) : (
        <div className="divide-y divide-border">
          {documents.map((document) => (
            <div key={document.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <FileText className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{document.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatLabel(document.type)} - uploaded {document.uploadedAt}
                  </p>
                </div>
              </div>
              <StatusBadge status={document.status} label={formatLabel(document.status)} />
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export function ClientActivityTab({ audit }: { audit: MvpAuditLog[] }) {
  return (
    <SectionPanel icon={Activity} title="Event activity">
      {audit.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Event changes, approvals, and client-visible updates will appear here."
        />
      ) : (
        <div className="divide-y divide-border">
          {audit.map((item) => (
            <div key={item.id} className="flex gap-3 py-3.5 text-sm">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-(--prism-amber)">
                <Activity className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{clientActivityTitle(item.action)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {clientActivityActor(item.actor)} - {item.createdAt}
                </p>
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
