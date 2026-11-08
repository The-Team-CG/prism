"use client";

import type { FormEvent } from "react";
import { VENUE_WALLS } from "@prism/floorplan-canvas";
import { useVenueSurvey, type VenueSurveyForm } from "../view-models/use-venue-survey";
import { Card, CardBody } from "@/features/event-dashboard/shell/views/sections/shell-ui";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const numbers: Array<[keyof VenueSurveyForm, string]> = [["widthM", "Width (m)"], ["lengthM", "Length (m)"], ["pillars", "Pillars"], ["emergencyExits", "Emergency exits"], ["doors", "Doors"]];

/** FR-81: after the ocular visit, PMCM records the venue's size and permanent features into the venue library. */
export function VenueSurveyPanel() {
  const vm = useVenueSurvey();
  function submit(event: FormEvent) {
    event.preventDefault();
    void vm.save();
  }
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-bold text-foreground">Save this venue to the library</h3>
        <p className="mt-1 text-xs text-muted-foreground">Record what you measured on the visit. The walls, pillars, exits, stage side and loading bay load locked onto the next floor plan for this venue.</p>
        {vm.error ? <p role="alert" className="mt-2 text-sm text-destructive">{vm.error}</p> : null}
        {vm.message ? <p role="status" className="mt-2 text-sm text-foreground">{vm.message}</p> : null}
        <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-3">Venue name<input required value={vm.form.venue} onChange={(event) => vm.setField("venue", event.target.value)} className={field} /></label>
          {numbers.map(([key, label]) => (
            <label key={key} className="text-sm">{label}<input required type="number" min={0} step="any" value={vm.form[key]} onChange={(event) => vm.setField(key, event.target.value)} className={field} /></label>
          ))}
          <label className="text-sm">Fixed stage side<select value={vm.form.stageWall} onChange={(event) => vm.setField("stageWall", event.target.value)} className={field}>{VENUE_WALLS.map((wall) => <option key={wall} value={wall}>{wall}</option>)}</select></label>
          <label className="text-sm">Loading bay<select value={vm.form.loadingBayWall} onChange={(event) => vm.setField("loadingBayWall", event.target.value)} className={field}><option value="">None</option>{VENUE_WALLS.map((wall) => <option key={wall} value={wall}>{wall} wall</option>)}</select></label>
          <label className="text-sm md:col-span-3">Venue rules<textarea rows={2} maxLength={2000} value={vm.form.venueRules} onChange={(event) => vm.setField("venueRules", event.target.value)} placeholder="Load-in hours, noise limits, restricted areas" className={field} /></label>
          <div><button type="submit" disabled={vm.busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{vm.busy ? "Saving…" : "Save to venue library"}</button></div>
        </form>
      </CardBody>
    </Card>
  );
}
