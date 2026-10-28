"use client";

import { useClientWorkspace } from "../../workspace/shared";
import {
  OfficialFloorPlanCard,
  FloorPlanCardHeader,
  FloorPlanDraftPanel,
  FloorPlanRevisionCommentCard,
  FloorPlanTemplates,
  GuidedLayoutNotes,
} from "./sections/client-floorplan-sections";
import { ClientFloorplanReviewPanel } from "../../floorplan-review/views/client-floorplan-review-panel";
import { selectClientFloorPlanLayout } from "../../workspace/model/client-floorplan-review-rules";

export function ClientFloorPlanView() {
  const {
    selectedEvent,
    officialDraft,
    preferenceDrafts,
    officialProject,
    floorPlanTemplates,
    form,
    setForm,
    openFloorplanEditor,
    createEditorDraft,
    refresh,
    submitPreference,
    busy,
  } = useClientWorkspace();

  const { officialPlan, activeDraft, isOfficial, draftApproved, approved, showReview, showPreferenceCard } =
    selectClientFloorPlanLayout(officialDraft, preferenceDrafts);

  return (
    <div className="space-y-5">
      {officialPlan ? <OfficialFloorPlanCard draft={officialPlan} officialProject={officialProject} onOpenEditor={openFloorplanEditor} /> : null}
      {selectedEvent && officialPlan && showReview ? (
        <ClientFloorplanReviewPanel eventId={selectedEvent.id} draftId={officialPlan.id} onDecided={refresh} />
      ) : null}
      <FloorPlanRevisionCommentCard draft={officialPlan ?? activeDraft} event={selectedEvent} />
      {showPreferenceCard ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <FloorPlanCardHeader approved={draftApproved} isOfficial={isOfficial} activeDraft={activeDraft} />
          <div className="p-6">
            <FloorPlanDraftPanel
              approved={draftApproved}
              isOfficial={isOfficial}
              activeDraft={activeDraft}
              officialProject={officialProject}
              onOpenEditor={openFloorplanEditor}
            />
            <FloorPlanTemplates
              approved={approved || Boolean(officialDraft)}
              templates={floorPlanTemplates}
              busy={busy}
              onCreate={createEditorDraft}
            />
          </div>
        </div>
      ) : null}
      <GuidedLayoutNotes
        approved={approved}
        preferenceDraft={preferenceDrafts.find((draft) => draft.sourceType === "client_preference")}
        form={form}
        setForm={setForm}
        busy={busy}
        onSubmit={submitPreference}
      />
    </div>
  );
}
