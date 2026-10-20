import {
  createFloorPlanPreferenceSchema,
  parseContract,
  type CreateFloorPlanPreferenceInput,
  type PrismFloorPlanDraft,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";

export type ClientFloorPlanPreferenceForm = Readonly<{
  name: string;
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string;
  notes: string;
}>;

export function canEditClientFloorPlanPreference(draft: PrismFloorPlanDraft | undefined) {
  return !draft || (draft.sourceType === "client_preference" && draft.status === "revision_requested");
}

export function preferenceFormFromDraft(draft: PrismFloorPlanDraft): ClientFloorPlanPreferenceForm | null {
  const preference = draft.clientPreference;
  if (!preference || draft.sourceType !== "client_preference") return null;
  return {
    name: draft.name,
    seatingStyle: preference.seatingStyle,
    stagePreference: preference.stagePreference,
    flowNotes: preference.flowNotes,
    guestCount: preference.guestCount,
    constraints: preference.constraints.join("\n"),
    notes: preference.notes ?? "",
  };
}

export function buildFloorPlanPreferencePayload(
  form: ClientFloorPlanPreferenceForm,
  extras: Partial<CreateFloorPlanPreferenceInput> = {},
): CreateFloorPlanPreferenceInput {
  return parseContract(
    createFloorPlanPreferenceSchema,
    {
      name: form.name,
      seatingStyle: form.seatingStyle,
      stagePreference: form.stagePreference,
      flowNotes: form.flowNotes,
      guestCount: form.guestCount,
      constraints: form.constraints
        .split(/\r?\n/)
        .map((constraint) => constraint.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      ...extras,
    },
    "Layout preference",
  );
}

export function buildReopenedFloorPlanPreferencePayload(
  draft: PrismFloorPlanDraft,
  project: Project,
): CreateFloorPlanPreferenceInput {
  if (draft.sourceType !== "client_preference" || draft.status !== "revision_requested") {
    throw new Error("Only a reopened client preference can be resubmitted from the editor.");
  }
  const form = preferenceFormFromDraft(draft);
  if (!form) throw new Error("The saved client preference details are unavailable.");

  return buildFloorPlanPreferencePayload(form, {
    name: project.name,
    venue: project.venue,
    width: Math.max(1, Math.round(project.widthM)),
    height: Math.max(1, Math.round(project.heightM)),
    gridSize: 1,
    guestCount: Math.max(1, Math.round(project.pax)),
    objects: project.objects,
  });
}
