"use client";

import Link from "next/link";
import { BadgeCheck, CalendarCheck, FileSignature, MapPinned, ReceiptText, type LucideIcon } from "lucide-react";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_HREFS } from "../../workspace/model/client-dashboard-navigation";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientFigureStrip, ClientListEmpty, ClientListRow, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { selectEventDrafts, selectEventWorkspaceResources, selectOfficialDraft } from "../../workspace/model/client-dashboard-selectors";
import { approvalStatusKind, buildApprovalItems, filterApprovalItems, type ApprovalItem } from "../model/client-approvals-rules";

const ICONS: Record<string, LucideIcon> = {
  Proposal: FileSignature,
  Contracts: FileSignature,
  Quotations: ReceiptText,
  "Layouts / Designs": MapPinned,
  "Final Confirmation": CalendarCheck,
};

/** Sub-views of the account-level approvals page. "All" is the page itself; each other tab is a filter on the same list. */
const APPROVAL_TABS: Array<{ id: string; label: string; href: string; view?: ClientPortalView }> = [
  { id: "approvals-all", label: "All", href: "/dashboard/approvals" },
  { id: "approvals-pending", label: "Pending", href: CLIENT_PORTAL_VIEW_HREFS["approvals-pending"], view: "approvals-pending" },
  { id: "approvals-approved", label: "Approved", href: CLIENT_PORTAL_VIEW_HREFS["approvals-approved"], view: "approvals-approved" },
  { id: "approvals-needs-revision", label: "Needs revision", href: CLIENT_PORTAL_VIEW_HREFS["approvals-needs-revision"], view: "approvals-needs-revision" },
  { id: "approvals-contracts", label: "Contracts", href: CLIENT_PORTAL_VIEW_HREFS["approvals-contracts"], view: "approvals-contracts" },
  { id: "approvals-quotations", label: "Quotations", href: CLIENT_PORTAL_VIEW_HREFS["approvals-quotations"], view: "approvals-quotations" },
  { id: "approvals-final-confirmation", label: "Final confirmation", href: CLIENT_PORTAL_VIEW_HREFS["approvals-final-confirmation"], view: "approvals-final-confirmation" },
];

type PortalApprovalItem = ApprovalItem & { event: PrismEvent };

function approvalTone(item: ApprovalItem): ClientRowTone {
  if (/revision|changes/i.test(item.status)) return "attention";
  return approvalStatusKind(item.status) === "success" ? "done" : "neutral";
}

export function ClientApprovalsView() {
  const { selectedEvent, officialDraft, billing, documents, events, isEventScopedView, portalView, state } = useClientWorkspace();

  if (!isEventScopedView) {
    if (events.length === 0) {
      return (
        <ClientListEmpty
          icon={BadgeCheck}
          title="No active event"
          description="Approvals appear once your event workspace is open."
          action={<Button asChild variant="outline" size="sm"><Link href="/dashboard/events">Go to My events</Link></Button>}
        />
      );
    }
    if (events.length === 1) return <ClientAccountEventPicker purpose="approvals" destination="approvals" />;
    return <PortalApprovals events={events} portalView={portalView} state={state} />;
  }

  const all = buildApprovalItems(selectedEvent, documents, billing, officialDraft);
  const visible = filterApprovalItems(all, portalView);
  const approved = all.filter((item) => approvalStatusKind(item.status) === "success").length;
  const revisions = all.filter((item) => /revision|changes/i.test(item.status)).length;

  return (
    <div className="space-y-4">
      <ClientFigureStrip
        label="Approval progress"
        figures={[
          { label: "Approved", value: `${approved} of ${all.length}`, tone: approved === all.length && all.length ? "done" : undefined },
          { label: "Still open", value: all.length - approved },
          { label: "Changes requested", value: revisions, tone: revisions ? "attention" : undefined },
        ]}
      />
      {visible.length ? (
        <ClientListSection id="client-approvals-list" title="Approvals" count={visible.length}>
          {visible.map((item) => {
            const tone = approvalTone(item);
            return (
              <ClientListRow
                key={item.title}
                icon={ICONS[item.title] ?? BadgeCheck}
                tone={tone}
                title={item.title}
                meta={item.detail}
                status={formatStatusLabel(item.status)}
                action="Review"
                href={selectedEvent ? dashboardHref(item.route, selectedEvent.id) : undefined}
              />
            );
          })}
        </ClientListSection>
      ) : (
        <ClientListEmpty icon={BadgeCheck} title="Nothing in this view" description="No approvals match this filter right now." />
      )}
    </div>
  );
}

/**
 * The account-level approvals pages across every event. Each sub-view filters the same approval items,
 * so the tabs change what is listed rather than only the title.
 */
function PortalApprovals({
  events,
  portalView,
  state,
}: {
  events: PrismEvent[];
  portalView?: ClientPortalView;
  state: PrismClientWorkspace | null;
}) {
  const allItems: PortalApprovalItem[] = events.flatMap((event) => {
    const resources = selectEventWorkspaceResources(state, event);
    const draft = selectOfficialDraft(selectEventDrafts(state, event));
    return buildApprovalItems(event, resources.documents, resources.billing, draft).map((item) => ({ ...item, event }));
  });
  const activeTab = APPROVAL_TABS.find((tab) => tab.view === portalView) ?? APPROVAL_TABS[0];
  const visible = filterApprovalItems(allItems, portalView);

  return (
    <div className="space-y-4">
      <ClientRouteTabs
        label="Approval views"
        activeId={activeTab.id}
        tabs={APPROVAL_TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          href: tab.href,
          count: filterApprovalItems(allItems, tab.view).length,
        }))}
      />
      {visible.length ? (
        <ClientListSection id="client-approvals-list" title={activeTab.label} count={visible.length}>
          {visible.map((item) => (
            <ClientListRow
              key={`${item.event.id}-${item.title}`}
              icon={ICONS[item.title] ?? BadgeCheck}
              tone={approvalTone(item)}
              title={item.title}
              meta={`${item.event.eventName} · ${item.detail}`}
              status={formatStatusLabel(item.status)}
              action="Review"
              href={dashboardHref(item.route, item.event.id)}
            />
          ))}
        </ClientListSection>
      ) : (
        <ClientListEmpty icon={BadgeCheck} title="Nothing in this view" description="No approvals match this filter across your events right now." />
      )}
    </div>
  );
}
