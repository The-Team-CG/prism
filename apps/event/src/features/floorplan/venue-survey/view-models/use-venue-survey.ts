"use client";

import { useState } from "react";
import { PASCAL_VERSION, venueSurveyFixtures, type VenueWall } from "@prism/floorplan-canvas";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import { addTemplate } from "@/features/floorplan/editor/data/templates-repository";
import { toast } from "@prism/ui/components/sonner";

export const emptyVenueSurvey = {
  venue: "", widthM: "", lengthM: "", pillars: "0", emergencyExits: "2", doors: "1",
  stageWall: "north" as VenueWall, loadingBayWall: "" as VenueWall | "", venueRules: "",
};
export type VenueSurveyForm = typeof emptyVenueSurvey;

const whole = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** FR-81: saves what PMCM measured on the ocular visit to the venue library, so the venue's fixtures pre-load on the next plan. */
export function useVenueSurvey() {
  const [form, setForm] = useState(emptyVenueSurvey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const widthM = Number(form.widthM);
    const lengthM = Number(form.lengthM);
    if (!form.venue.trim() || !(widthM > 0) || !(lengthM > 0)) {
      setError("Enter the venue name, width and length.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const objects = venueSurveyFixtures({
        widthM, lengthM, pillars: whole(form.pillars), emergencyExits: whole(form.emergencyExits), doors: whole(form.doors),
        stageWall: form.stageWall, loadingBayWall: form.loadingBayWall || null,
      });
      // The measured room and its fixed features become the venue's Pascal scene, which every draft from it copies.
      const scene = convertLegacyPlan({ name: form.venue.trim(), widthM, heightM: lengthM, objects }, PASCAL_VERSION);
      await addTemplate({
        name: form.venue.trim(), venue: form.venue.trim(), description: `Measured on ocular visit: ${widthM} m × ${lengthM} m`,
        venueRules: form.venueRules, pax: 0, scene,
      });
      toast.success(`${form.venue.trim()} is in the venue library with ${objects.length} fixed features.`);
      setForm(emptyVenueSurvey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the venue.");
    } finally {
      setBusy(false);
    }
  }

  return { form, setField: (key: keyof VenueSurveyForm, value: string) => setForm((current) => ({ ...current, [key]: value })), busy, error, save };
}
