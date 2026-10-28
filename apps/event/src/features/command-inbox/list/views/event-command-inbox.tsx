import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, RotateCcw } from "lucide-react";
import type { PrismCommandInboxItem, PrismPmcmCommandInbox } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { selectCommandInboxTriage } from "../model/command-inbox-selectors";
import { COMMAND_INBOX_ACTION_LABEL, COMMAND_INBOX_AREA_LABEL } from "../model/command-inbox-labels";
import { Button } from "@/app/components/ui/button";
import { cx } from "@/features/pmcm-kit";

const EM_DASH = "—";
const ROW_GRID = "sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_10rem_auto]";

function InboxRow({ item }: { item: PrismCommandInboxItem }) {
  const urgent = item.severity === "critical";
  const when = item.dueAt ?? item.createdAt ?? null;
  return (
    <li className={cx("grid gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 sm:items-center", ROW_GRID)} data-testid="command-inbox-row">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="min-w-0 break-words">{item.label}</span>
          {urgent ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Blocker</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={item.description}>
          {COMMAND_INBOX_AREA_LABEL[item.kind]}{item.description ? ` · ${item.description}` : ""}
        </p>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate text-foreground" title={item.eventName ?? undefined}>
          {item.eventName ?? <span className="text-muted-foreground">{EM_DASH}</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.clientName ?? EM_DASH}</p>
      </div>
      <p className="text-sm tabular-nums">
        {when ? (
          <>
            <span className="text-xs text-muted-foreground">{item.dueAt ? "Due " : "Added "}</span>
            <span className={cx(urgent && item.dueAt ? "font-semibold text-danger" : "text-foreground")}>{formatPortalDateTime(when)}</span>
          </>
        ) : <span className="text-muted-foreground">{EM_DASH}</span>}
      </p>
      <div className="sm:text-right">
        {item.href ? (
          <Link href={item.href} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {COMMAND_INBOX_ACTION_LABEL[item.kind]}<ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : <span className="text-xs text-muted-foreground">No action link</span>}
      </div>
    </li>
  );
}

function InboxRows({ items }: { items: PrismCommandInboxItem[] }) {
  return (
    <>
      <div className={cx("hidden gap-x-4 border-b border-border pb-2 text-xs text-muted-foreground sm:grid", ROW_GRID)} aria-hidden>
        <span>Issue</span><span>Event</span><span>Due</span><span className="text-right">Action</span>
      </div>
      <ul>{items.map((item) => <InboxRow key={item.id} item={item} />)}</ul>
    </>
  );
}

function InboxSection({ id, title, count, urgent, children }: { id: string; title: string; count: number; urgent?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cx("rounded-lg border bg-card px-4 py-3", urgent ? "border-danger/30" : "border-border")}>
      <h2 id={id} className="flex items-baseline gap-2 pb-2 text-base font-semibold text-foreground">
        {title}<span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function InboxPager({ inbox, onPageChange }: { inbox: PrismPmcmCommandInbox | null; onPageChange: (page: number) => void }) {
  if (!inbox || (inbox.page.index === 0 && !inbox.page.hasMore)) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" className="min-h-11" disabled={inbox.page.index === 0} onClick={() => onPageChange(inbox.page.index - 1)}>Previous page</Button>
      <span className="text-xs text-muted-foreground">Page {inbox.page.index + 1}</span>
      <Button variant="outline" size="sm" className="min-h-11" disabled={!inbox.page.hasMore} onClick={() => onPageChange(inbox.page.index + 1)}>Next page</Button>
    </div>
  );
}

type InboxTriage = ReturnType<typeof selectCommandInboxTriage>;

function InboxHeader({ inbox, counts, loadFailed, onRefresh }: { inbox: PrismPmcmCommandInbox | null; counts: InboxTriage["counts"]; loadFailed: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {inbox ? (
          <p className="text-sm text-foreground" data-testid="command-inbox-counts">
            <span className={cx("font-semibold tabular-nums", counts.urgent > 0 && "text-danger")}>{counts.urgent} urgent</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold tabular-nums">{counts.needsAction} need action</span>
            <span className="text-muted-foreground"> · </span>
            <span className="tabular-nums">{counts.reference} updates</span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{inboxFreshness(inbox, loadFailed)}</p>
      </div>
      <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={onRefresh}>
        <RotateCcw className="mr-1.5 size-3.5" aria-hidden />Refresh
      </Button>
    </div>
  );
}

function inboxFreshness(inbox: PrismPmcmCommandInbox | null, loadFailed: boolean) {
  if (inbox) return `Page ${inbox.page.index + 1} · Updated ${formatPortalDateTime(inbox.generatedAt)} · Philippine time`;
  return loadFailed ? "Updates unavailable" : "Loading updates…";
}

function InboxTriageSections({ triage }: { triage: InboxTriage }) {
  const { counts } = triage;
  return (
    <>
      {counts.urgent > 0 ? (
        <InboxSection id="command-inbox-urgent" title="Urgent blockers" count={counts.urgent} urgent>
          <InboxRows items={triage.urgent} />
        </InboxSection>
      ) : null}
      {counts.needsAction > 0 ? (
        <InboxSection id="command-inbox-needs-action" title="Needs action" count={counts.needsAction}>
          <InboxRows items={triage.needsAction} />
        </InboxSection>
      ) : null}
      {counts.reference > 0 ? (
        <details className="group rounded-lg border border-border bg-card px-4 py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-semibold text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Updates and reference
            <span className="text-sm font-normal tabular-nums text-muted-foreground">{counts.reference}</span>
          </summary>
          <div className="pt-2"><InboxRows items={triage.reference} /></div>
        </details>
      ) : null}
    </>
  );
}

function InboxBody({ inbox, triage, loadFailed, onRefresh }: { inbox: PrismPmcmCommandInbox | null; triage: InboxTriage; loadFailed: boolean; onRefresh: () => void }) {
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
        <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={onRefresh}>Retry</Button>
      </section>
    );
  }
  if (triage.counts.total === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground">No pending actions</p>
        <p className="mt-1 text-sm text-muted-foreground">No items were returned for this page. You can still review events and inquiries from the sidebar.</p>
      </section>
    );
  }
  return <InboxTriageSections triage={triage} />;
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

  return (
    <div className="space-y-4">
      <InboxHeader inbox={inbox} counts={triage.counts} loadFailed={loadFailed} onRefresh={onRefresh} />

      {loadFailed && inbox ? (
        <p role="alert" className="rounded-md bg-attention-soft p-3 text-sm text-attention">
          The latest refresh failed. These are the last loaded updates. Refresh again before making a time-sensitive decision.
        </p>
      ) : null}

      <InboxBody inbox={inbox} triage={triage} loadFailed={loadFailed} onRefresh={onRefresh} />

      <InboxPager inbox={inbox} onPageChange={onPageChange} />
    </div>
  );
}
