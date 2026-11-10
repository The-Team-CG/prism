"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDateTime } from "@prism/ui/format-date";

import type { PrismDecisionLogEntry } from "@prism/types";
import { DECISION_LOG_KIND_LABELS, formatDecisionActor, formatDecisionToken } from "../model/decision-log-kinds";
import { useDecisionLogViewModel } from "../view-models/use-decision-log-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";

function formatDecidedAt(iso: string) {
  return formatPortalDateTime(iso);
}

type DecisionLogViewModel = ReturnType<typeof useDecisionLogViewModel>;

export function DecisionLogPanel({ eventId }: { eventId: string }) {
  const vm = useDecisionLogViewModel(eventId);

  return (
    <section aria-labelledby="decision-log-heading" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="decision-log-heading" className="text-lg font-bold text-foreground">Decision log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Overrides, approvals, waivers, and scope changes for this event, newest first. Reasons come from each source record.
          </p>
        </div>
        <DecisionKindFilter vm={vm} />
      </header>

      <DecisionLogStatus vm={vm} />

      {vm.entries.length > 0 ? (
        <ol className="divide-y divide-border">
          {vm.entries.map((entry) => (
            <DecisionLogRow key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : null}

      {vm.log && (vm.hasPrevious || vm.hasMore) ? <DecisionLogPager vm={vm} /> : null}
    </section>
  );
}

function DecisionLogStatus({ vm }: { vm: DecisionLogViewModel }) {
  return (
    <>
      {vm.loading && !vm.log ? <LoadingState label="Loading decision log…" /> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.log && vm.entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {vm.kind ? `No ${DECISION_LOG_KIND_LABELS[vm.kind].toLowerCase()} decisions recorded.` : "No decisions recorded for this event yet."}
        </p>
      ) : null}
    </>
  );
}

function DecisionKindFilter({ vm }: { vm: DecisionLogViewModel }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
      Type
      <Select
        value={vm.kind ?? "all"}
        onValueChange={(value) => {
          const option = vm.kindOptions.find((candidate) => candidate.value === value);
          if (option) vm.setKind(option.value);
        }}
      >
        <SelectTrigger aria-label="Type" className="w-full min-w-0 text-sm font-normal text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {vm.kindOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label} ({option.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DecisionLogPager({ vm }: { vm: DecisionLogViewModel }) {
  if (!vm.log) return null;
  return (
    <nav aria-label="Decision log pages" className="flex items-center justify-between gap-2 text-sm">
      <button type="button" className="rounded-md border border-border px-3 py-1.5 font-semibold disabled:opacity-50" onClick={vm.previousPage} disabled={!vm.hasPrevious || vm.loading}>
        Newer
      </button>
      <span className="text-muted-foreground">
        Page {vm.page + 1} of {Math.max(1, Math.ceil(vm.log.page.total / vm.log.page.size))}
      </span>
      <button type="button" className="rounded-md border border-border px-3 py-1.5 font-semibold disabled:opacity-50" onClick={vm.nextPage} disabled={!vm.hasMore || vm.loading}>
        Older
      </button>
    </nav>
  );
}

function DecisionLogRow({ entry }: { entry: PrismDecisionLogEntry }) {
  return (
    <li className="space-y-1 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">
          {DECISION_LOG_KIND_LABELS[entry.kind]}: {formatDecisionToken(entry.decision)}
        </p>
        <time dateTime={entry.decidedAt} className="text-xs text-muted-foreground">{formatDecidedAt(entry.decidedAt)}</time>
      </div>
      <p className="text-foreground">{entry.subject}</p>
      <p className="text-muted-foreground">{entry.reason ? `Reason: ${entry.reason}` : "No reason recorded."}</p>
      <p className="text-xs text-muted-foreground">
        {formatDecisionActor(entry.actor)} · Source {formatDecisionToken(entry.sourceRef.type)} {entry.sourceRef.id}
      </p>
    </li>
  );
}
