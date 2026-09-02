"use client";

import type { ReactNode } from "react";
import { BadgeCheck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { PageHeader } from "../../workspace/shared";
import { formatStatusLabel } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import {
  approvalStatusKind,
  buildApprovalItems,
  filterApprovalItems,
  type ApprovalItem,
} from "../model/client-approvals-rules";

function statusIcon(status: string) {
  const kind = approvalStatusKind(status);
  if (kind === "success") return <CheckCircle2 className="size-4 text-(--prism-success)" />;
  if (kind === "pending") return <Clock className="size-4 text-(--prism-amber)" />;
  return <BadgeCheck className="size-4 text-muted-foreground" />;
}

function ApprovalsEmpty({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
        <BadgeCheck className="size-6 text-muted-foreground" />
      </span>
      <h3 className="mt-4 text-base font-black text-foreground">{title}</h3>
      <p className={compact ? "mt-2 text-sm text-muted-foreground" : "mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground"}>{description}</p>
      {action}
    </div>
  );
}

function ApprovalItemRow({ item }: { item: ApprovalItem }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:border-(--prism-signal)/20 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 shrink-0">{statusIcon(item.status)}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{item.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
        </div>
      </div>
      <StatusBadge status={item.status} label={formatStatusLabel(item.status)} />
    </div>
  );
}

export function ClientApprovalsView() {
  const {
    router,
    portalView,
    selectedEvent,
    officialDraft,
    billing,
    documents,
    isEventScopedView,
  } = useClientWorkspace();
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;
  const visibleApprovalItems = filterApprovalItems(
    buildApprovalItems(selectedEvent, documents, billing, officialDraft),
    portalView,
  );
  const showHeader = !isEventScopedView && Boolean(portalViewMeta);
  const showNoEvent = !selectedEvent && !isEventScopedView;

  return (
    <div className="space-y-5">
      {showHeader && portalViewMeta ? (
        <PageHeader eyebrow="Client approvals" title={portalViewMeta.title} description={portalViewMeta.description} />
      ) : null}
      {showNoEvent ? (
        <ApprovalsEmpty
          title="No active event"
          description="Select an event from My Events to view approval items."
          action={
            <Button variant="outline" className="mt-5 rounded-lg font-semibold" onClick={() => router.push("/dashboard/events")}>
              Go to My Events
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {visibleApprovalItems.length ? (
            visibleApprovalItems.map((item) => <ApprovalItemRow key={item.title} item={item} />)
          ) : (
            <ApprovalsEmpty title="All clear" description="No approval items in this view." compact />
          )}
        </div>
      )}
    </div>
  );
}
