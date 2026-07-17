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
import type {
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismPaymentMilestone,
} from "@/lib/prism-api";
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
import type { DetailTab } from "../../workspace/model/client-dashboard.types";


export function ClientActivityTab({ audit }: { audit: PrismAuditLog[] }) {
  if (audit.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Event changes, approvals, and client-visible updates will appear here."
          />
        </CardBody>
      </Card>
    );
  }

  const grouped = groupByDay(audit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Event activity</h2>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([day, items]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {formatDayLabel(day)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                      {actorInitials(item.actor)}
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        {clientActivityTitle(item.action)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {clientActivityActor(item.actor)} — {item.createdAt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
