"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import type { PrismRetentionPolicy, PrismRetentionReviewItem } from "@prism/types";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Switch } from "@prism/ui/components/switch";
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
        {vm.error ? (
          <Alert variant="destructive">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2">
          {vm.policies.map((policy) => (
            <PolicyRow key={policy.category} policy={policy} vm={vm} />
          ))}
        </div>
        <section className="space-y-3" aria-labelledby="retention-review-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="retention-review-title" className="font-semibold text-foreground">Review queue</h3>
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

/** What a rule does, in one sentence: when it applies, then what it removes and keeps. */
function ruleSentence(policy: PrismRetentionPolicy) {
  const when = retentionPeriodCopy(policy).replace(/\s*\((enabled|disabled)\)$/i, "");
  return `${when.charAt(0).toUpperCase()}${when.slice(1)}: ${policy.deletionBehavior.charAt(0).toLowerCase()}${policy.deletionBehavior.slice(1)}`;
}

/**
 * One retention rule, said in plain words with whether it is on. Changing it (on or off, or its period) opens an editor,
 * since every change needs a reason on the record.
 */
function PolicyRow({ policy, vm }: { policy: PrismRetentionPolicy; vm: PrivacyRetentionViewModel }) {
  // Reference-only categories have no review source: they show their terms but offer no controls.
  const referenceOnly = !vm.canEnable(policy);
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-foreground">{policy.label}</p>
        <span className={policy.enabled ? "rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success" : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"}>{referenceOnly ? "Reference only" : policy.enabled ? "On" : "Off"}</span>
      </div>
      <p className="text-xs text-muted-foreground">{ruleSentence(policy)}</p>
      {referenceOnly ? (
        <p className="text-xs text-muted-foreground">This kind of record has no review source, so it can&apos;t be turned on or changed here.</p>
      ) : !editing ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>Change</Button>
      ) : (
        <PolicyEditor policy={policy} vm={vm} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}

function PolicyEditor({ policy, vm, onDone }: { policy: PrismRetentionPolicy; vm: PrivacyRetentionViewModel; onDone: () => void }) {
  const [enabled, setEnabled] = useState(policy.enabled);
  return (
        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-2 text-xs">
          <label className="flex items-center gap-2 font-medium text-foreground"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`${policy.label} on`} />{enabled ? "On" : "Off"} · revision {policy.revision}</label>
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
            <span className="text-muted-foreground">days</span>
            <Button type="button" disabled={vm.busy} onClick={() => {
              // Saving needs a reason; without one the view model says so and the editor stays open.
              const hasReason = Boolean((vm.reasonDrafts[policy.category] ?? "").trim());
              vm.savePolicy(policy, { enabled, usePeriodDraft: true });
              if (hasReason) onDone();
            }}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          </div>
        </div>
  );
}

function ReviewItemRow({ item, vm }: { item: PrismRetentionReviewItem; vm: PrivacyRetentionViewModel }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{label(item.category)}</p>
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
