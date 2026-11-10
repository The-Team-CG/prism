"use client";

import type { FormEvent } from "react";
import { VENUE_WALLS } from "@prism/floorplan-canvas";
import { useVenueSurvey, type VenueSurveyForm } from "../view-models/use-venue-survey";
import { Card, CardContent } from "@prism/ui/components/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

/** Radix Select cannot take an empty-string item value, so "no loading bay" uses this sentinel. */
const NO_LOADING_BAY = "__no_loading_bay__";
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
      <CardContent>
        <h3 className="text-sm font-bold text-foreground">Save this venue to the library</h3>
        <p className="mt-1 text-xs text-muted-foreground">Record what you measured on the visit. The walls, pillars, exits, stage side and loading bay load locked onto the next floor plan for this venue.</p>
        {vm.error ? <p role="alert" className="mt-2 text-sm text-destructive">{vm.error}</p> : null}
        <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-3">Venue name<input required value={vm.form.venue} onChange={(event) => vm.setField("venue", event.target.value)} className={field} /></label>
          {numbers.map(([key, label]) => (
            <label key={key} className="text-sm">{label}<input required type="number" min={0} step="any" value={vm.form[key]} onChange={(event) => vm.setField(key, event.target.value)} className={field} /></label>
          ))}
          <div className="text-sm">
            <span>Fixed stage side</span>
            <Select value={vm.form.stageWall} onValueChange={(value) => vm.setField("stageWall", value)}>
              <SelectTrigger aria-label="Fixed stage side" className="mt-1 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENUE_WALLS.map((wall) => <SelectItem key={wall} value={wall}>{wall}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm">
            <span>Loading bay</span>
            <Select value={vm.form.loadingBayWall || NO_LOADING_BAY} onValueChange={(value) => vm.setField("loadingBayWall", value === NO_LOADING_BAY ? "" : value)}>
              <SelectTrigger aria-label="Loading bay" className="mt-1 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LOADING_BAY}>None</SelectItem>
                {VENUE_WALLS.map((wall) => <SelectItem key={wall} value={wall}>{wall} wall</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="text-sm md:col-span-3">Venue rules<textarea rows={2} maxLength={2000} value={vm.form.venueRules} onChange={(event) => vm.setField("venueRules", event.target.value)} placeholder="Load-in hours, noise limits, restricted areas" className={field} /></label>
          <div><button type="submit" disabled={vm.busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{vm.busy ? "Saving…" : "Save to venue library"}</button></div>
        </form>
      </CardContent>
    </Card>
  );
}
