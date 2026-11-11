"use client";

import { Button } from "@prism/ui/components/button";
import { DatePicker } from "@prism/ui/components/date-picker";
import { impactHeadline } from "../model/impact-rules";
import { useDateImpactViewModel } from "../view-models/use-date-impact-view-model";
import { ApprovedSection, PaymentsSection, PlanSection, SuppliersSection } from "./impact-sections";

/**
 * What moving an event's date touches, before or after it is recorded. This only reads: bookings, payments and anything the
 * client approved stay with their owners. The one thing that can follow the date from here is the plan, by an explicit step.
 */
export function DateImpactPanel({ eventId }: { eventId: string }) {
  const vm = useDateImpactViewModel(eventId);
  const { impact } = vm;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          New date to check (optional)
          <span className="font-normal"><DatePicker value={vm.draftDate} onValueChange={vm.setDraftDate} aria-label="New date to check" className="h-10 w-56" /></span>
        </label>
        <Button variant="outline" className="rounded-lg font-semibold" onClick={vm.check}>{vm.draftDate ? "Check this date" : "Review the current date"}</Button>
        {vm.checkedDate ? <Button variant="ghost" onClick={vm.reset}>Clear</Button> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a date being considered to see what it would touch before recording it. Leave it empty after a date change was recorded
        to see what still follows the old date.
      </p>
      {vm.loadError ? <p role="alert" className="text-sm text-destructive">{vm.loadError}</p> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {impact ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{impactHeadline(impact)}</p>
          <PlanSection impact={impact} vm={vm} />
          <SuppliersSection impact={impact} />
          <PaymentsSection impact={impact} />
          <ApprovedSection impact={impact} />
        </div>
      ) : vm.loadError ? null : <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
