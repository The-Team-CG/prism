import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { PrismCommandInboxItem, PrismCommandInboxSeverity, PrismPmcmCommandInbox } from "@prism/types";
import { selectCommandInboxGroupedBySeverity } from "../model/command-inbox-selectors";
import { Button } from "@/app/components/ui/button";
import { compactTimestamp, cx, label, severityTone } from "@/features/pmcm-kit";
import { Panel } from "@/features/pmcm-kit";

const SEVERITY_LABEL: Record<PrismCommandInboxSeverity, string> = {
  critical: "Emergency",
  warning: "Needs Attention",
  attention: "For Review",
  info: "Informational",
};

function severityIcon(severity: PrismCommandInboxSeverity) {
  if (severity === "critical") return AlertTriangle;
  if (severity === "warning") return AlertTriangle;
  if (severity === "attention") return Eye;
  return CheckCircle2;
}

function severityIconColor(severity: PrismCommandInboxSeverity) {
  if (severity === "critical") return "text-rose-600";
  if (severity === "warning") return "text-amber-600";
  if (severity === "attention") return "text-blue-600";
  return "text-emerald-600";
}

function InboxItem({ item }: { item: PrismCommandInboxItem }) {
  const Icon = severityIcon(item.severity);
  const iconColor = severityIconColor(item.severity);

  const card = (
    <div className={cx(
      "flex items-start gap-3 rounded-lg border px-4 py-3",
      item.href && "cursor-pointer transition-colors hover:bg-accent/50",
      item.severity === "critical" ? "border-rose-200 bg-rose-50/50 ring-1 ring-rose-100" : "border-border bg-card",
    )}>
      <div className="mt-0.5 shrink-0">
        <Icon className={cx("size-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-foreground">{item.label}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.eventName && (
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-foreground ring-1 ring-inset ring-border">
              {item.eventName}
            </span>
          )}
          <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset", severityTone(item.severity))}>
            {label(item.kind)}
          </span>
          <span className="text-xs text-muted-foreground">
            {compactTimestamp(item.dueAt ?? item.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );

  return item.href ? <Link href={item.href} className="block">{card}</Link> : card;
}

export function EventCommandInbox({
  inbox,
  onRefresh,
  onPageChange,
  loadFailed,
}: {
  inbox: PrismPmcmCommandInbox | null;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  loadFailed: boolean;
}) {
  const groups = useMemo(
    () => selectCommandInboxGroupedBySeverity(inbox?.items ?? []),
    [inbox],
  );

  const totalCount = inbox
    ? inbox.counts.critical + inbox.counts.warning + inbox.counts.attention + inbox.counts.info
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-4" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">{totalCount} action item{totalCount !== 1 ? "s" : ""}</p>
            <p className="text-xs text-muted-foreground">
              {inbox ? `Page ${inbox.page.index + 1} · ${compactTimestamp(inbox.generatedAt)}` : "Loading..."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg font-bold" onClick={onRefresh}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {!inbox && !loadFailed ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm font-black text-foreground">Loading command inbox...</p>
            <p className="mt-1 text-xs text-muted-foreground">Fetching the latest action items.</p>
          </div>
        </Panel>
      ) : loadFailed ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <AlertTriangle className="mx-auto size-8 text-amber-500" />
            <p className="mt-3 text-sm font-black text-foreground">Could not load inbox</p>
            <p className="mt-1 text-xs text-muted-foreground">Try refreshing.</p>
          </div>
        </Panel>
      ) : groups.length === 0 ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
            <p className="mt-3 text-sm font-black text-foreground">No pending actions</p>
            <p className="mt-1 text-xs text-muted-foreground">All command inbox items have been addressed.</p>
          </div>
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel key={group.severity} title={SEVERITY_LABEL[group.severity]} icon={severityIcon(group.severity)}>
            <div className="flex items-center gap-2 pb-3">
              <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ring-inset", severityTone(group.severity))}>
                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {group.items.map((item) => (
                <InboxItem key={item.id} item={item} />
              ))}
            </div>
          </Panel>
        ))
      )}

      {inbox && (inbox.page.index > 0 || inbox.page.hasMore) ? (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={inbox.page.index === 0} onClick={() => onPageChange(inbox.page.index - 1)}>
            Previous page
          </Button>
          <span className="text-xs text-muted-foreground">Page {inbox.page.index + 1}</span>
          <Button variant="outline" size="sm" disabled={!inbox.page.hasMore} onClick={() => onPageChange(inbox.page.index + 1)}>
            Next page
          </Button>
        </div>
      ) : null}
    </div>
  );
}
