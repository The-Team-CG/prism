import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  FileText,
  Inbox,
  MapPinned,
  MessageSquareText,
  Radio,
  ReceiptText,
  RotateCcw,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { PrismCommandInboxItem, PrismCommandInboxKind, PrismPmcmCommandInbox } from "@prism/types";
import { daysUntil, dueLabel, formatPortalDate, formatPortalDateTime, formatPortalTime, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { selectCommandInboxTriage } from "../model/command-inbox-selectors";
import { COMMAND_INBOX_AREA_LABEL, commandInboxActionLabel } from "../model/command-inbox-labels";
import { Button } from "@prism/ui/components/button";
import { cx } from "@/features/pmcm-kit";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Card } from "@prism/ui/components/card";
import { PrismListCluster, PrismListRow, type PrismListTone } from "@prism/ui/action-list";

const KIND_ICON: Record<PrismCommandInboxKind, LucideIcon> = {
  inquiry: FileSignature,
  conforme: FileSignature,
  briefing: ClipboardCheck,
  billing: ReceiptText,
  document: FileText,
  floorplan: MapPinned,
  approval: BadgeCheck,
  supplier: Truck,
  coordinator: UsersRound,
  closure: CalendarCheck,
  live_ops: Radio,
  change_request: Building2,
  addendum: FileSignature,
  feedback: MessageSquareText,
};

type InboxTriage = ReturnType<typeof selectCommandInboxTriage>;
type GroupBy = "priority" | "event";

const SEVERITY_TONE: Record<PrismCommandInboxItem["severity"], PrismListTone> = { critical: "urgent", warning: "attention", attention: "attention", info: "neutral" };

function dueTone(days: number, urgent: boolean): PrismListTone {
  if (days < 0 || (urgent && days === 0)) return "urgent";
  return days <= 1 ? "attention" : "neutral";
}

/** Due phrase when the item has a deadline, otherwise when it was added. */
export function inboxRowWhen(item: Pick<PrismCommandInboxItem, "dueAt" | "createdAt" | "severity">, todayKey: string): { label: string; tone: PrismListTone; title?: string } | null {
  const days = item.dueAt ? daysUntil(manilaCalendarKey(item.dueAt), todayKey) : null;
  if (days !== null && item.dueAt) return { label: dueLabel(days), tone: dueTone(days, item.severity === "critical"), title: formatPortalDateTime(item.dueAt) };
  if (!item.createdAt) return null;
  return { label: `Added ${formatPortalDate(item.createdAt)}`, tone: "neutral", title: formatPortalDateTime(item.createdAt) };
}

function InboxRow({ item, todayKey }: { item: PrismCommandInboxItem; todayKey: string }) {
  const when = inboxRowWhen(item, todayKey);
  return (
    <PrismListRow
      testId="command-inbox-row"
      icon={KIND_ICON[item.kind] ?? Inbox}
      tone={SEVERITY_TONE[item.severity]}
      title={item.label}
      tag={item.severity === "critical" ? "Blocker" : undefined}
      meta={[COMMAND_INBOX_AREA_LABEL[item.kind], item.eventName, item.clientName, item.description].filter(Boolean).join(" · ")}
      metaTitle={item.description || undefined}
      status={when?.label}
      statusTone={when?.tone}
      statusTitle={when?.title}
      action={commandInboxActionLabel(item)}
      href={item.href}
      link={Link}
    />
  );
}

/** Needs action shows this many rows before "Show more"; blockers always show in full. */
const NEEDS_ACTION_LIMIT = 5;

/** Three or more items of the same kind and title collapse into one expandable row. */
const CLUSTER_MIN = 3;

export function clusterInboxItems(items: PrismCommandInboxItem[]) {
  const clusters: PrismCommandInboxItem[][] = [];
  const byKey = new Map<string, PrismCommandInboxItem[]>();
  for (const item of items) {
    const key = `${item.kind}:${item.label}`;
    const cluster = byKey.get(key);
    if (cluster) cluster.push(item);
    else {
      const next = [item];
      byKey.set(key, next);
      clusters.push(next);
    }
  }
  return clusters.flatMap((cluster) => (cluster.length >= CLUSTER_MIN ? [cluster] : cluster.map((item) => [item])));
}

function InboxCluster({ items, todayKey }: { items: PrismCommandInboxItem[]; todayKey: string }) {
  const [first] = items;
  const events = new Set(items.map((item) => item.eventName).filter(Boolean)).size;
  return (
    <PrismListCluster
      testId="command-inbox-cluster"
      icon={KIND_ICON[first.kind] ?? Inbox}
      tone={SEVERITY_TONE[first.severity]}
      title={`${items.length} × ${first.label}`}
      tag={first.severity === "critical" ? "Blocker" : undefined}
      meta={`${COMMAND_INBOX_AREA_LABEL[first.kind]}${events > 0 ? ` · across ${events} event${events === 1 ? "" : "s"}` : ""}`}
    >
      {items.map((item) => <InboxRow key={item.id} item={item} todayKey={todayKey} />)}
    </PrismListCluster>
  );
}

function InboxGroup({
  id,
  title,
  meta,
  count,
  items,
  todayKey,
  collapsible,
  limit,
}: {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  count: number;
  items: PrismCommandInboxItem[];
  todayKey: string;
  collapsible?: boolean;
  /** Show this many rows (a group row counts as one) and fold the rest behind "Show more". */
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const clusters = clusterInboxItems(items);
  const shown = limit && !expanded ? clusters.slice(0, limit) : clusters;
  const hidden = clusters.length - shown.length;
  const heading = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span id={id} className="truncate text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
    </span>
  );
  const rows = (
    <>
      <ul aria-labelledby={id} className="divide-y divide-border">
        {shown.map((cluster) =>
          cluster.length === 1
            ? <InboxRow key={cluster[0].id} item={cluster[0]} todayKey={todayKey} />
            : <InboxCluster key={cluster[0].id} items={cluster} todayKey={todayKey} />,
        )}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-11 w-full items-center gap-1 border-t border-border px-4 text-sm font-medium text-primary hover:bg-surface-raised"
        >
          Show {hidden} more <ChevronRight className="size-4 rotate-90" aria-hidden />
        </button>
      ) : null}
    </>
  );
  if (collapsible) {
    return (
      <details className="group border-t border-border first:border-t-0">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 bg-muted/40 px-4 py-2">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          {heading}
        </summary>
        {rows}
      </details>
    );
  }
  return (
    <section className="border-t border-border first:border-t-0">
      <h2 className="flex min-h-10 items-center bg-muted/40 px-4 py-2">{heading}</h2>
      {rows}
    </section>
  );
}

function groupByEvent(items: PrismCommandInboxItem[]) {
  const groups = new Map<string, { key: string; eventName: string; clientName?: string | null; eventId?: string | null; items: PrismCommandInboxItem[] }>();
  for (const item of items) {
    const key = item.eventId ?? "no-event";
    const group = groups.get(key) ?? { key, eventName: item.eventName ?? "Not linked to an event", clientName: item.clientName, eventId: item.eventId, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function InboxList({ triage, groupBy, todayKey }: { triage: InboxTriage; groupBy: GroupBy; todayKey: string }) {
  if (groupBy === "event") {
    const actionable = [...triage.urgent, ...triage.needsAction];
    return (
      <Card className="gap-0 block overflow-hidden rounded-lg border border-border bg-card">
        {groupByEvent(actionable).map((group) => (
          <InboxGroup
            key={group.key}
            id={`command-inbox-event-${group.key}`}
            title={group.eventId ? <Link href={`/dashboard/events/${encodeURIComponent(group.eventId)}/overview`} className="hover:text-primary">{group.eventName}</Link> : group.eventName}
            meta={group.clientName}
            count={group.items.length}
            items={group.items}
            todayKey={todayKey}
          />
        ))}
        {triage.reference.length > 0 ? (
          <InboxGroup id="command-inbox-reference" title="Updates and reference" count={triage.reference.length} items={triage.reference} todayKey={todayKey} collapsible />
        ) : null}
      </Card>
    );
  }
  return (
    <Card className="gap-0 block overflow-hidden rounded-lg border border-border bg-card">
      {triage.urgent.length > 0 ? (
        <InboxGroup id="command-inbox-urgent" title="Blockers" count={triage.urgent.length} items={triage.urgent} todayKey={todayKey} />
      ) : null}
      {triage.needsAction.length > 0 ? (
        <InboxGroup id="command-inbox-needs-action" title="Needs action" count={triage.needsAction.length} items={triage.needsAction} todayKey={todayKey} limit={NEEDS_ACTION_LIMIT} />
      ) : null}
      {triage.reference.length > 0 ? (
        <InboxGroup id="command-inbox-reference" title="Updates and reference" count={triage.reference.length} items={triage.reference} todayKey={todayKey} collapsible />
      ) : null}
    </Card>
  );
}

function InboxToolbar({
  inbox,
  loadFailed,
  groupBy,
  onGroupBy,
  onRefresh,
}: {
  inbox: PrismPmcmCommandInbox | null;
  loadFailed: boolean;
  groupBy: GroupBy;
  onGroupBy: (value: GroupBy) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Group inbox" className="flex gap-1 rounded-md bg-muted p-1">
        {(["priority", "event"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={groupBy === value}
            onClick={() => onGroupBy(value)}
            className={cx(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              groupBy === value ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "priority" ? "By priority" : "By event"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {inbox ? `Updated ${formatPortalTime(inbox.generatedAt)}` : loadFailed ? "Updates unavailable" : "Loading updates…"}
        </span>
        <Button variant="outline" size="sm" onClick={onRefresh} aria-label="Refresh inbox">
          <RotateCcw className="size-3.5" aria-hidden />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function InboxPager({ inbox, onPageChange }: { inbox: PrismPmcmCommandInbox | null; onPageChange: (page: number) => void }) {
  if (!inbox || (inbox.page.index === 0 && !inbox.page.hasMore)) return null;
  return (
    <nav aria-label="Inbox pages" className="flex items-center justify-end gap-2 text-sm">
      <span className="mr-auto text-xs text-muted-foreground">Page {inbox.page.index + 1}</span>
      <Button variant="outline" size="sm" disabled={inbox.page.index === 0} onClick={() => onPageChange(inbox.page.index - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" aria-hidden /> Previous
      </Button>
      <Button variant="outline" size="sm" disabled={!inbox.page.hasMore} onClick={() => onPageChange(inbox.page.index + 1)} aria-label="Next page">
        Next <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

function InboxBody({
  inbox,
  triage,
  loadFailed,
  groupBy,
  todayKey,
  onRefresh,
}: {
  inbox: PrismPmcmCommandInbox | null;
  triage: InboxTriage;
  loadFailed: boolean;
  groupBy: GroupBy;
  todayKey: string;
  onRefresh: () => void;
}) {
  if (!inbox && !loadFailed) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-center">
        <LoadingState label="Loading command inbox..." />
      </section>
    );
  }
  if (!inbox) {
    return (
      <section role="alert" className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground">Could not load inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">The command inbox did not respond.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRefresh}>Retry</Button>
      </section>
    );
  }
  if (triage.counts.total === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success"><BadgeCheck className="size-5" aria-hidden /></span>
        <p className="text-sm font-semibold text-foreground">No pending actions</p>
        <p className="max-w-md text-sm text-muted-foreground">Nothing needs PMCM right now. New inquiries, approvals and event blockers will appear here.</p>
      </section>
    );
  }
  return <InboxList triage={triage} groupBy={groupBy} todayKey={todayKey} />;
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
  const triage = useMemo(() => selectCommandInboxTriage(inbox?.items ?? []), [inbox]);
  const [groupBy, setGroupBy] = useState<GroupBy>("priority");
  const todayKey = manilaDateKey();

  return (
    <div className="space-y-4">
      <InboxToolbar inbox={inbox} loadFailed={loadFailed} groupBy={groupBy} onGroupBy={setGroupBy} onRefresh={onRefresh} />

      {loadFailed && inbox ? (
        <p role="alert" className="rounded-md bg-attention-soft p-3 text-sm text-attention">
          The latest refresh failed. These are the last loaded updates. Refresh again before making a time-sensitive decision.
        </p>
      ) : null}

      <InboxBody inbox={inbox} triage={triage} loadFailed={loadFailed} groupBy={groupBy} todayKey={todayKey} onRefresh={onRefresh} />

      <InboxPager inbox={inbox} onPageChange={onPageChange} />
    </div>
  );
}
