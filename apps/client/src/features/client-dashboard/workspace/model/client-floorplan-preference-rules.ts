import {
  createFloorPlanPreferenceSchema,
  parseContract,
  type CreateFloorPlanPreferenceInput,
} from "@prism/types";

export type ClientFloorPlanPreferenceForm = Readonly<{
  name: string;
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string;
  notes: string;
}>;

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
