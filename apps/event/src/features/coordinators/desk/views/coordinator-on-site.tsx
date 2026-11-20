"use client";

import { Clock, ClipboardList, Ellipsis, ListOrdered, Radio, RefreshCw, TriangleAlert } from "lucide-react";
import type { PrismCoordinatorRoleView } from "@prism/types";
import type { PrismShellNavItem as PrismNavItem } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { isOpenTask, issueAreaOptions, openIssues } from "../model/coordinator-shift";
import { COORDINATOR_VIEW_LABELS, type CoordinatorViewId } from "../model/coordinator-portal-routes";
import { useUpdatedAgo } from "../view-models/use-updated-ago";
import type { CoordinatorIssueFormModel } from "./sections/coordinator-role-sections";
import { CoordinatorQuickReport } from "./sections/coordinator-quick-report";

/** Pages the More tab stands for, so it lights up on any of them. */
const MORE_VIEWS: CoordinatorViewId[] = ["more", "calendar", "messages", "notifications", "assignments", "account", "registration"];

/**
 * The phone tab bar: Now, Tasks, Issues, Run sheet and More, each within thumb reach. Tasks and Issues carry the
 * number still open; More carries unread messages.
 */
export function coordinatorMobileTabs({ roleView, href, unreadMessages }: {
  roleView: PrismCoordinatorRoleView | null;
  href: (view: CoordinatorViewId) => string;
  unreadMessages?: number;
}): PrismNavItem[] {
  const tasks = roleView?.tasks.filter(isOpenTask).length ?? 0;
  const issues = roleView ? openIssues(roleView.urgentIssues).length : 0;
  return [
    { id: "shift", label: COORDINATOR_VIEW_LABELS.shift, icon: Clock, href: href("shift") },
    { id: "tasks", label: COORDINATOR_VIEW_LABELS.tasks, icon: ClipboardList, href: href("tasks"), badge: tasks || undefined, badgeLabel: `${tasks} open tasks` },
    { id: "issues", label: COORDINATOR_VIEW_LABELS.issues, icon: TriangleAlert, href: href("issues"), badge: issues || undefined, badgeLabel: `${issues} open issues` },
    { id: "run-sheet", label: COORDINATOR_VIEW_LABELS["run-sheet"], icon: ListOrdered, href: href("run-sheet") },
    {
      id: "more",
      label: COORDINATOR_VIEW_LABELS.more,
      icon: Ellipsis,
      href: href("more"),
      badge: unreadMessages || undefined,
      badgeLabel: `${unreadMessages ?? 0} unread messages`,
      subItems: MORE_VIEWS.map((id) => ({ id, label: COORDINATOR_VIEW_LABELS[id] })),
    },
  ];
}

/** Report, floating above the phone tab bar on every page. */
export function ReportFab({ onReport }: { onReport: () => void }) {
  return (
    <Button type="button" onClick={onReport} aria-label="Report an issue" className="h-13 rounded-full px-5 text-base font-semibold shadow-lg shadow-primary/30">
      <Radio className="size-5" aria-hidden />Report
    </Button>
  );
}

/** "Updated 20 s ago" with a Refresh button, so a coordinator on patchy signal knows whether what they see is current. */
export function FreshnessLine({ roleView, loading, onRefresh }: { roleView: PrismCoordinatorRoleView | null; loading: boolean; onRefresh: () => void }) {
  const { label } = useUpdatedAgo(roleView);
  if (!roleView) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <p role="status" aria-live="polite" className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-success" />
        {loading ? "Refreshing…" : label}
      </p>
      <Button type="button" variant="ghost" size="sm" className="min-h-9 text-xs" disabled={loading} onClick={onRefresh}>
        <RefreshCw className="size-3.5" aria-hidden />Refresh
      </Button>
    </div>
  );
}

/** The quick report in a panel: from the bottom on a phone, from the side on a larger screen. */
export function ReportIssueSheet({ issueForm, roleView, venue, eventName, open, side, onOpenChange, onReported }: {
  issueForm: CoordinatorIssueFormModel;
  roleView: PrismCoordinatorRoleView | null;
  venue?: string;
  eventName?: string;
  open: boolean;
  side: "right" | "bottom";
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}) {
  const areas = roleView ? issueAreaOptions(roleView, venue) : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={side === "bottom" ? "max-h-[92dvh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"}>
        <SheetHeader>
          <SheetTitle>Report an issue</SheetTitle>
          <SheetDescription>{eventName ? `${eventName}. PMCM sees it as soon as you send it.` : "PMCM sees it as soon as you send it."}</SheetDescription>
        </SheetHeader>
        {/* Rendered only while open, so each report starts fresh. */}
        <div className="px-4 pb-6">{open ? <CoordinatorQuickReport issueForm={issueForm} areas={areas} onDone={onReported} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}
