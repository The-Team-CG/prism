"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BadgeCheck, FileText, MessageSquareText, WalletCards, type LucideIcon } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";
import { useClientWorkspace } from "../../client-workspace-context";
import { dashboardHref } from "../../model/client-dashboard-navigation";
import type { ClientDashboardRoute } from "../../model/client-dashboard-types";
import { formatStatusLabel, money } from "../../model/client-dashboard-view-rules";
import { ClientListRow, ClientListSection, type ClientRowTone } from "../../../shared/client-list-ui";
import { clientMilestoneRemaining } from "../../../billing/model/client-billing-rules";
import { eventCountdown, orderClientEvents } from "../../../home/model/client-home-summary";

type EventDestination = Extract<ClientDashboardRoute, "approvals" | "billing" | "documents" | "messages">;

const DESTINATION: Record<EventDestination, { icon: LucideIcon; action: string }> = {
  approvals: { icon: BadgeCheck, action: "Open approvals" },
  billing: { icon: WalletCards, action: "Open billing" },
  documents: { icon: FileText, action: "Open files" },
  messages: { icon: MessageSquareText, action: "Open messages" },
};

/** The one fact that helps pick an event for this destination: what's owed, how many files, or when it is. */
function eventSummary(destination: EventDestination, event: PrismEvent, state: PrismClientWorkspace | null, today: string): { label: string; tone: ClientRowTone } {
  if (destination === "billing" && state) {
    const owed = state.paymentMilestones.filter((payment) => payment.eventId === event.id && payment.status !== "paid").reduce((sum, payment) => sum + clientMilestoneRemaining(payment), 0);
    return owed > 0 ? { label: `${money.format(owed)} due`, tone: "attention" } : { label: "Nothing due", tone: "done" };
  }
  if (destination === "documents" && state) {
    const count = state.documents.filter((document) => document.eventId === event.id).length;
    return { label: count === 1 ? "1 file" : `${count} files`, tone: "neutral" };
  }
  return { label: eventCountdown(event.eventDate, today) ?? formatStatusLabel(event.status), tone: "neutral" };
}

/**
 * Account-level pages belong to an event. One event opens directly (the link stays as a fallback);
 * several events get a compact list that lands on the same section of the chosen event.
 */
export function ClientAccountEventPicker({ purpose, destination }: { purpose: string; destination: EventDestination }) {
  const { events, router, state } = useClientWorkspace();
  const onlyEventHref = events.length === 1 ? dashboardHref(destination, events[0].id) : null;

  useEffect(() => {
    if (onlyEventHref) router.replace(onlyEventHref);
  }, [onlyEventHref, router]);

  if (events.length === 0) return null;
  if (onlyEventHref) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening {purpose} for{" "}
        <Link href={onlyEventHref} className="font-medium text-primary hover:text-primary/80">{events[0].eventName}</Link>…
      </p>
    );
  }
  const today = manilaDateKey();
  const { icon, action } = DESTINATION[destination];
  return (
    <ClientListSection id="client-account-event-picker" title={`Choose an event to see its ${purpose}`} count={events.length}>
      {orderClientEvents(events).map((event) => {
        const summary = eventSummary(destination, event, state, today);
        return (
          <ClientListRow
            key={event.id}
            icon={icon}
            tone={summary.tone}
            title={event.eventName}
            meta={[formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed", formatStatusLabel(event.status)].join(" · ")}
            status={summary.label}
            action={action}
            href={dashboardHref(destination, event.id)}
          />
        );
      })}
    </ClientListSection>
  );
}
