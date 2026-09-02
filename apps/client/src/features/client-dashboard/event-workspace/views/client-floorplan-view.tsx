"use client";

import { useClientWorkspace } from "../../workspace/shared";
import {
  FloorPlanCardHeader,
  FloorPlanDraftPanel,
  FloorPlanTemplates,
  GuidedLayoutNotes,
} from "./sections/client-floorplan-sections";

export function ClientFloorPlanView() {
  const {
    officialDraft,
    preferenceDrafts,
    officialProject,
    floorPlanTemplates,
    form,
    setForm,
    openFloorplanEditor,
    createEditorDraft,
    submitPreference,
    busy,
  } = useClientWorkspace();

  const activeDraft = officialDraft ?? preferenceDrafts[0];
  const approved = activeDraft?.status === "approved";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <FloorPlanCardHeader approved={approved} activeDraft={activeDraft} />
        <div className="p-6">
          <FloorPlanDraftPanel
            approved={approved}
            activeDraft={activeDraft}
            officialProject={officialProject}
            onOpenEditor={openFloorplanEditor}
          />
          <FloorPlanTemplates
            approved={approved}
            templates={floorPlanTemplates}
            busy={busy}
            onCreate={createEditorDraft}
          />
        </div>
      </div>
      <GuidedLayoutNotes
        approved={approved}
        form={form}
        setForm={setForm}
        busy={busy}
        onSubmit={submitPreference}
      />
    </div>
  );
}
