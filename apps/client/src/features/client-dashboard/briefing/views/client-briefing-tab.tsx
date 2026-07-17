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
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";


export function ClientBriefingTab({ briefing }: { briefing?: PrismBriefing }) {
  const isComplete = Boolean(
    briefing?.venue && briefing?.guestCount && briefing?.serviceRequirements?.length,
  );

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border px-5 py-4 ${
        isComplete
          ? "border-(--prism-success)/25 bg-(--prism-success)/8"
          : "border-(--prism-amber)/25 bg-(--prism-amber-soft)"
      }`}>
        <p className={`text-sm font-bold ${isComplete ? "text-(--prism-success)" : "text-(--prism-amber)"}`}>
          {isComplete ? "Briefing complete" : "Briefing in progress"}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {isComplete
            ? "All core briefing details are on file."
            : "Your event team is still confirming the venue, guest count, and service requirements."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Event briefing</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Confirmed details from your PMCM event team</p>
        </CardHeader>
        <CardBody>
          {briefing ? (
            <InfoGrid items={[
              { label: "Venue", value: briefing.venue },
              { label: "Guest count", value: `${briefing.guestCount} guests` },
              { label: "Budget range", value: briefing.budgetRange },
              { label: "Service requirements", value: briefing.serviceRequirements.join(", ") },
            ]} />
          ) : (
            <EmptyState
              icon={FileCheck2}
              title="No briefing yet"
              description="Confirmed venue, schedule, guest count, budget, and service notes will appear here."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
