"use client";

import { ShieldCheck } from "lucide-react";

import type { PrismRetentionPolicy, PrismRetentionReviewItem } from "@prism/types";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { compactTimestamp, label, Panel } from "@/features/pmcm-kit";
import { retentionPeriodCopy, reviewStatusLabel } from "../model/retention-rules";
import { usePrivacyRetentionViewModel, type PrivacyRetentionViewModel } from "../view-models/use-privacy-retention-view-model";
import type { ReviewStatusFilter } from "../use-cases/retention-use-cases";

const STATUS_OPTIONS: ReviewStatusFilter[] = ["pending", "held", "executed", "dismissed", "all"];

/** Retention controls mounted in the privacy console; owns its policy and review data. */
export function PrivacyRetentionPanel() {
  const vm = usePrivacyRetentionViewModel();
  return <PrivacyRetentionView vm={vm} />;
}

export function PrivacyRetentionView({ vm }: { vm: PrivacyRetentionViewModel }) {
  return (
    <Panel title="Retention policies and review queue" icon={ShieldCheck}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Records past retention are queued for review. Nothing is deleted or anonymized until an operator executes an item,
          and active legal holds mark items as held.
        </p>
        {vm.message ? (
          <Alert variant={vm.message.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{vm.message.text}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid min-w-0 gap-2">
          {vm.policies.map((policy) => (
            <PolicyRow key={policy.category} policy={policy} vm={vm} />
          ))}
        </div>
        <section className="space-y-3" aria-labelledby="retention-review-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="retention-review-title" className="font-black text-foreground">Review queue</h3>
            <Select value={vm.statusFilter} onValueChange={(value) => vm.setStatusFilter(value as ReviewStatusFilter)}>
              <SelectTrigger aria-label="Review status filter" className="h-9 w-48 min-w-0 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{label(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {vm.items.length === 0 ? <p className="text-sm text-muted-foreground">No review items match this filter.</p> : null}
          {vm.items.map((item) => (
            <ReviewItemRow key={item.id} item={item} vm={vm} />
          ))}
          {vm.hasMore ? <button type="button" disabled={vm.busy} onClick={vm.loadMore} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Load more</button> : null}
        </section>
      </div>
    </Panel>
  );
}

function PolicyRow({ policy, vm }: { policy: PrismRetentionPolicy; vm: PrivacyRetentionViewModel }) {
  // Reference-only categories have no review source: they show their terms but offer no controls.
  const referenceOnly = !vm.canEnable(policy);
  return (
    <div className="space-y-2 rounded-md bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-foreground">{policy.label}</p>
        <p className="text-muted-foreground">{policy.enabled ? "Enabled" : "Disabled"} · revision {policy.revision}</p>
      </div>
      <p className="text-muted-foreground">{retentionPeriodCopy(policy)}</p>
      <p className="text-muted-foreground">{policy.deletionBehavior}</p>
      {referenceOnly ? (
        <p className="text-muted-foreground">Reference only. This category has no review source, so it can&apos;t be enabled or changed here.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          <Input
            aria-label={`Reason for ${policy.label} change`}
            value={vm.reasonDrafts[policy.category] ?? ""}
            onChange={(event) => vm.setReasonDraft(policy.category, event.target.value)}
            className="h-9 w-full min-w-0 bg-white"
            placeholder="Reason for the change"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Input
              aria-label={`Retention days for ${policy.label}`}
              inputMode="numeric"
              value={vm.periodDrafts[policy.category] ?? String(policy.periodDays)}
              onChange={(event) => vm.setPeriodDraft(policy.category, event.target.value)}
              className="h-9 w-24 bg-white"
            />
            <Button type="button" variant="outline" disabled={vm.busy} onClick={() => vm.savePolicy(policy, { usePeriodDraft: true })}>
              Save period
            </Button>
            <Button type="button" disabled={vm.busy} onClick={() => vm.savePolicy(policy, { enabled: !policy.enabled })}>
              {policy.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewItemRow({ item, vm }: { item: PrismRetentionReviewItem; vm: PrivacyRetentionViewModel }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-foreground">{label(item.category)}</p>
        <p className="text-muted-foreground">{reviewStatusLabel(item.status)}</p>
      </div>
      <p className="text-muted-foreground">
        Due since {compactTimestamp(item.dueSince)}{item.eventId ? ` · event ${item.eventId}` : ""}
      </p>
      {item.decisionReason ? <p className="text-muted-foreground">Decision note: {item.decisionReason}</p> : null}
      {vm.canExecute(item) || vm.canDismiss(item) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {vm.canExecute(item) ? (
            <>
              <Input
                aria-label={`Execution note for ${item.id}`}
                value={vm.notesDrafts[item.id] ?? ""}
                onChange={(event) => vm.setNotesDraft(item.id, event.target.value)}
                className="h-9 bg-white"
                placeholder="Execution note (optional)"
              />
              <Button type="button" disabled={vm.busy} onClick={() => vm.executeItem(item)}>
                Execute redaction
              </Button>
            </>
          ) : null}
          {vm.canDismiss(item) ? (
            <>
              <Input
                aria-label={`Dismissal reason for ${item.id}`}
                value={vm.reasonDrafts[item.id] ?? ""}
                onChange={(event) => vm.setReasonDraft(item.id, event.target.value)}
                className="h-9 bg-white"
                placeholder="Dismissal reason (required)"
              />
              <Button type="button" variant="outline" disabled={vm.busy} onClick={() => vm.dismissItem(item)}>
                Dismiss
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
