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
  Loader2,
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
import { COMMAND_INBOX_ACTION_LABEL, COMMAND_INBOX_AREA_LABEL } from "../model/command-inbox-labels";
import { Button } from "@/app/components/ui/button";
import { cx } from "@/features/pmcm-kit";

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
  feedback: MessageSquareText,
};

type InboxTriage = ReturnType<typeof selectCommandInboxTriage>;
type GroupBy = "priority" | "event";

const SEVERITY_BAR: Record<PrismCommandInboxItem["severity"], string> = { critical: "border-l-danger", warning: "border-l-attention", attention: "border-l-attention", info: "border-l-transparent" };
const SEVERITY_TILE: Record<PrismCommandInboxItem["severity"], string> = { critical: "bg-danger-soft text-danger", warning: "bg-attention-soft text-attention", attention: "bg-attention-soft text-attention", info: "bg-muted text-muted-foreground" };

function dueTone(days: number, urgent: boolean) {
  if (days < 0 || (urgent && days === 0)) return "font-semibold text-danger";
  return days <= 1 ? "font-medium text-attention" : "text-muted-foreground";
}

/** Due phrase when the item has a deadline, otherwise when it was added. */
function InboxRowWhen({ item, todayKey }: { item: PrismCommandInboxItem; todayKey: string }) {
  const days = item.dueAt ? daysUntil(manilaCalendarKey(item.dueAt), todayKey) : null;
  if (days !== null) {
    return (
      <span title={item.dueAt ? formatPortalDateTime(item.dueAt) : undefined} className={cx("tabular-nums", dueTone(days, item.severity === "critical"))}>
        {dueLabel(days)}
      </span>
    );
  }
  if (!item.createdAt) return null;
  return <span title={formatPortalDateTime(item.createdAt)} className="text-muted-foreground">Added {formatPortalDate(item.createdAt)}</span>;
}

function InboxRowTitle({ item }: { item: PrismCommandInboxItem }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
      {item.href ? (
        <Link href={item.href} className="truncate outline-none after:absolute after:inset-0">
          {item.label}
        </Link>
      ) : (
        <span className="truncate">{item.label}</span>
      )}
      {item.severity === "critical" ? <span className="shrink-0 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger">Blocker</span> : null}
    </p>
  );
}

function InboxRow({ item, todayKey }: { item: PrismCommandInboxItem; todayKey: string }) {
  const Icon = KIND_ICON[item.kind] ?? Inbox;
  const meta = [COMMAND_INBOX_AREA_LABEL[item.kind], item.eventName, item.clientName, item.description].filter(Boolean).join(" · ");
  return (
    <li
      data-testid="command-inbox-row"
      className={cx(
        "relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-l-[3px] py-3 pl-3 pr-4 transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised sm:grid-cols-[2rem_minmax(0,1fr)_9rem_11.5rem] sm:items-center",
        SEVERITY_BAR[item.severity],
      )}
    >
      <span aria-hidden className={cx("grid size-8 place-items-center rounded-md", SEVERITY_TILE[item.severity])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <InboxRowTitle item={item} />
        <p className="truncate text-xs text-muted-foreground" title={item.description || undefined}>{meta}</p>
      </div>
      <p className="col-start-2 whitespace-nowrap text-xs sm:col-start-auto sm:text-sm">
        <InboxRowWhen item={item} todayKey={todayKey} />
      </p>
      <span className="hidden items-center justify-end gap-1 whitespace-nowrap text-sm font-medium text-primary sm:flex">
        {item.href ? (
          <>
            {COMMAND_INBOX_ACTION_LABEL[item.kind]}
            <ChevronRight className="size-4" aria-hidden />
          </>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">No action link</span>
        )}
      </span>
    </li>
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
}: {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  count: number;
  items: PrismCommandInboxItem[];
  todayKey: string;
  collapsible?: boolean;
}) {
  const heading = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span id={id} className="truncate text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
    </span>
  );
  const rows = (
    <ul aria-labelledby={id} className="divide-y divide-border">
      {items.map((item) => <InboxRow key={item.id} item={item} todayKey={todayKey} />)}
    </ul>
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
      <div className="overflow-hidden rounded-lg border border-border bg-card">
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
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {triage.urgent.length > 0 ? (
        <InboxGroup id="command-inbox-urgent" title="Urgent blockers" count={triage.urgent.length} items={triage.urgent} todayKey={todayKey} />
      ) : null}
      {triage.needsAction.length > 0 ? (
        <InboxGroup id="command-inbox-needs-action" title="Needs action" count={triage.needsAction.length} items={triage.needsAction} todayKey={todayKey} />
      ) : null}
      {triage.reference.length > 0 ? (
        <InboxGroup id="command-inbox-reference" title="Updates and reference" count={triage.reference.length} items={triage.reference} todayKey={todayKey} collapsible />
      ) : null}
    </div>
  );
}

function SummaryStrip({ inbox, triage }: { inbox: PrismPmcmCommandInbox; triage: InboxTriage }) {
  const paged = inbox.page.hasMore || inbox.page.index > 0;
  const stats: Array<{ label: string; value: number; href?: string; tone?: string }> = [
    { label: paged ? "Urgent on this page" : "Urgent", value: triage.counts.urgent, tone: triage.counts.urgent > 0 ? "text-danger" : undefined },
    { label: paged ? "Need action on this page" : "Need action", value: triage.counts.needsAction, tone: triage.counts.needsAction > 0 ? "text-attention" : undefined },
    { label: "Inquiries to review", value: inbox.summary.pendingInquiries, href: "/dashboard/inquiries" },
    { label: "Approvals waiting", value: inbox.summary.pendingApprovals, href: "/dashboard/messages/approvals" },
    { label: "Active events", value: inbox.summary.activeEvents, href: "/dashboard/events" },
  ];
  return (
    <dl data-testid="command-inbox-counts" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-5 sm:divide-x sm:divide-border">
      {stats.map((stat) => {
        const body = (
          <>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className={cx("mt-0.5 text-xl font-semibold tabular-nums text-foreground", stat.tone)}>{stat.value}</dd>
          </>
        );
        return stat.href ? (
          <Link key={stat.label} href={stat.href} className="block px-4 py-3 transition-colors hover:bg-surface-raised">{body}</Link>
        ) : (
          <div key={stat.label} className="px-4 py-3">{body}</div>
        );
      })}
    </dl>
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
              groupBy === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-foreground">Loading command inbox...</p>
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
      {inbox ? <SummaryStrip inbox={inbox} triage={triage} /> : null}
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
