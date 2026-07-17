"use client";

import { BadgeCheck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { PageHeader } from "../../workspace/shared";
import { formatStatusLabel } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

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

    const approvalItems = selectedEvent ? [
      {
        title: "Contracts",
        detail: documents.filter((document) => /contract|conforme|moa|nda/i.test(document.type)).length
          ? "Contract files are available for this event."
          : "Contracts will appear after PMCM uploads them.",
        status: documents.some((document) => /contract|conforme|moa|nda/i.test(document.type)) ? "approved" : "pending",
      },
      {
        title: "Quotations",
        detail: billing ? `${billing.number} is linked to the approved proposal package.` : "Quotation and billing details are being prepared.",
        status: billing?.status ?? "pending",
      },
      {
        title: "Layouts / Designs",
        detail: officialDraft ? `Official layout is ${formatStatusLabel(officialDraft.status)}.` : "PMCM has not published an official layout yet.",
        status: officialDraft?.status ?? "pending",
      },
      {
        title: "Final Confirmation",
        detail: selectedEvent.readiness ? `Readiness is ${formatStatusLabel(selectedEvent.readiness)}.` : "Final confirmation is pending.",
        status: selectedEvent.readiness ?? selectedEvent.status,
      },
    ] : [];
    const visibleApprovalItems = approvalItems.filter((item) => {
      if (portalView === "approvals-pending" || portalView === "dashboard-pending-approvals") return item.status !== "approved";
      if (portalView === "approvals-approved") return item.status === "approved";
      if (portalView === "approvals-needs-revision") return /revision|changes/i.test(item.status);
      if (portalView === "approvals-contracts") return item.title === "Contracts";
      if (portalView === "approvals-quotations") return item.title === "Quotations";
      if (portalView === "approvals-final-confirmation") return item.title === "Final Confirmation";
      return true;
    });
  
    const statusIcon = (status: string) => {
      if (/approved|done|confirmed/i.test(status)) return <CheckCircle2 className="size-4 text-(--prism-success)" />;
      if (/pending|waiting|preparation/i.test(status)) return <Clock className="size-4 text-(--prism-amber)" />;
      return <BadgeCheck className="size-4 text-muted-foreground" />;
    };
  
    return (
      <div className="space-y-5">
        {!isEventScopedView && portalViewMeta && (
          <PageHeader eyebrow="Client approvals" title={portalViewMeta.title} description={portalViewMeta.description} />
        )}
        {!selectedEvent && !isEventScopedView ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
              <BadgeCheck className="size-6 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No active event</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
              Select an event from My Events to view approval items.
            </p>
            <Button variant="outline" className="mt-5 rounded-lg font-semibold" onClick={() => router.push("/dashboard/events")}>
              Go to My Events
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleApprovalItems.length ? visibleApprovalItems.map((item) => (
              <div key={item.title} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:border-(--prism-signal)/20 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 shrink-0">{statusIcon(item.status)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <StatusBadge status={item.status} label={formatStatusLabel(item.status)} />
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                  <BadgeCheck className="size-6 text-muted-foreground" />
                </span>
                <h3 className="mt-4 text-base font-black text-foreground">All clear</h3>
                <p className="mt-2 text-sm text-muted-foreground">No approval items in this view.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
}
