"use client";

import Link from "next/link";
import { BadgeCheck, CalendarCheck, FileSignature, MapPinned, ReceiptText, type LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { ClientFigureStrip, ClientListEmpty, ClientListRow, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { approvalStatusKind, buildApprovalItems, filterApprovalItems, type ApprovalItem } from "../model/client-approvals-rules";

const ICONS: Record<string, LucideIcon> = {
  Proposal: FileSignature,
  Contracts: FileSignature,
  Quotations: ReceiptText,
  "Layouts / Designs": MapPinned,
  "Final Confirmation": CalendarCheck,
};

function approvalTone(item: ApprovalItem): ClientRowTone {
  if (/revision|changes/i.test(item.status)) return "attention";
  return approvalStatusKind(item.status) === "success" ? "done" : "neutral";
}

export function ClientApprovalsView() {
  const { selectedEvent, officialDraft, billing, documents, events, isEventScopedView, portalView } = useClientWorkspace();

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
    return <ClientAccountEventPicker purpose="approvals" destination="approvals" />;
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
