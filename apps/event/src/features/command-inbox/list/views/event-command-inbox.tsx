import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { PrismCommandInboxItem, PrismCommandInboxSeverity, PrismPmcmCommandInbox } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { selectCommandInboxGroupedBySeverity } from "../model/command-inbox-selectors";
import { Button } from "@/app/components/ui/button";
import { cx, label } from "@/features/pmcm-kit";
import { Panel } from "@/features/pmcm-kit";

const SEVERITY_LABEL: Record<PrismCommandInboxSeverity, string> = {
  critical: "Urgent attention",
  warning: "Needs attention",
  attention: "For review",
  info: "Updates and reference",
};

const ITEM_ACTION: Record<PrismCommandInboxItem["kind"], string> = {
  inquiry: "Review inquiry", conforme: "Review conforme", briefing: "Review briefing",
  billing: "Review billing", document: "Review document", floorplan: "Review layout",
  approval: "Review approval", supplier: "Review supplier work", coordinator: "Review assignment",
  closure: "Review closeout", live_ops: "Open live operations", change_request: "Review change request", feedback: "Review feedback",
};

function severityIcon(severity: PrismCommandInboxSeverity) {
  if (severity === "critical") return AlertTriangle;
  if (severity === "warning") return AlertTriangle;
  if (severity === "attention") return Eye;
  return Eye;
}

function severityIconColor(severity: PrismCommandInboxSeverity) {
  if (severity === "critical") return "text-danger";
  if (severity === "warning") return "text-attention";
  if (severity === "attention") return "text-info";
  return "text-muted-foreground";
}

function InboxItem({ item }: { item: PrismCommandInboxItem }) {
  const Icon = severityIcon(item.severity);
  const iconColor = severityIconColor(item.severity);

  const card = (
    <div className={cx(
      "flex items-start gap-3 rounded-lg border px-4 py-3",
      item.href && "cursor-pointer transition-colors hover:bg-accent/50",
      item.severity === "critical" ? "border-danger/25 bg-danger-soft/50 ring-1 ring-danger/20" : "border-border bg-card",
    )}>
      <div className="mt-0.5 shrink-0">
        <Icon className={cx("size-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-foreground">{item.label}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.eventName && (
            <span className="text-sm font-medium text-foreground">
              {item.eventName}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {label(item.kind)}
          </span>
          {item.clientName ? <span className="text-xs text-muted-foreground">Client: {item.clientName}</span> : null}
          {item.dueAt || item.createdAt ? <span className="text-xs text-muted-foreground">{item.dueAt ? "Due: " : "Added: "}{formatPortalDateTime(item.dueAt ?? item.createdAt)}</span> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Status: {label(item.status)}</p>
        {item.href ? <span className="mt-3 inline-flex min-h-8 items-center text-sm font-semibold text-primary">{ITEM_ACTION[item.kind]}</span> : null}
      </div>
    </div>
  );

  return item.href ? <Link href={item.href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary">{card}</Link> : card;
}

function InboxPager({
  inbox,
  onPageChange,
}: {
  inbox: PrismPmcmCommandInbox | null;
  onPageChange: (page: number) => void;
}) {
  if (!inbox || (inbox.page.index === 0 && !inbox.page.hasMore)) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={inbox.page.index === 0} onClick={() => onPageChange(inbox.page.index - 1)}>
        Previous page
      </Button>
      <span className="text-xs text-muted-foreground">Page {inbox.page.index + 1}</span>
      <Button variant="outline" size="sm" disabled={!inbox.page.hasMore} onClick={() => onPageChange(inbox.page.index + 1)}>
        Next page
      </Button>
    </div>
  );
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
            <p className="text-sm font-semibold text-foreground">{inbox ? `On this page: ${totalCount - inbox.counts.info} need attention · ${inbox.counts.info} updates` : loadFailed ? "Updates unavailable" : "Loading updates…"}</p>
            <p className="text-xs text-muted-foreground">
              {inbox ? `Page ${inbox.page.index + 1} · Updated ${formatPortalDateTime(inbox.generatedAt)} · Philippine time` : "Loading..."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg font-bold" onClick={onRefresh}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {loadFailed && inbox ? <p role="alert" className="rounded-md bg-attention-soft p-4 text-sm text-attention">The latest refresh failed. These are the last loaded updates. Refresh again before making a time-sensitive decision.</p> : null}

      {!inbox && !loadFailed ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm font-black text-foreground">Loading command inbox...</p>
            <p className="mt-1 text-xs text-muted-foreground">Fetching the latest action items.</p>
          </div>
        </Panel>
      ) : loadFailed && !inbox ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <AlertTriangle className="mx-auto size-8 text-attention" />
            <p className="mt-3 text-sm font-black text-foreground">Could not load inbox</p>
            <p className="mt-1 text-xs text-muted-foreground">Try refreshing.</p>
          </div>
        </Panel>
      ) : groups.length === 0 ? (
        <Panel title="Command Inbox" icon={Inbox}>
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
            <p className="mt-3 text-sm font-black text-foreground">No pending actions</p>
            <p className="mt-1 text-sm text-muted-foreground">No items were returned for this page. You can still review events and inquiries from the sidebar.</p>
          </div>
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel key={group.severity} title={SEVERITY_LABEL[group.severity]} icon={severityIcon(group.severity)}>
            <div className="flex items-center gap-2 pb-3">
              <span className="text-xs text-muted-foreground">
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

      <InboxPager inbox={inbox} onPageChange={onPageChange} />
    </div>
  );
}
