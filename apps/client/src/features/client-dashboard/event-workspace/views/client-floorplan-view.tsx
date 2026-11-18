"use client";

import { Card } from "@prism/ui/components/card";
import { useClientWorkspace } from "../../workspace/shared";
import {
  OfficialFloorPlanCard,
  FloorPlanCardHeader,
  FloorPlanDraftPanel,
  FloorPlanRevisionCommentCard,
  GuidedLayoutNotes,
} from "./sections/client-floorplan-sections";
import { ClientFloorplanReviewPanel } from "../../floorplan-review/views/client-floorplan-review-panel";
import { selectClientFloorPlanLayout } from "../../workspace/model/client-floorplan-review-rules";

export function ClientFloorPlanView() {
  const {
    selectedEvent,
    officialDraft,
    preferenceDrafts,
    officialLayout,
    form,
    setForm,
    openFloorplanEditor,
    refresh,
    submitPreference,
    busy,
  } = useClientWorkspace();

  const { officialPlan, activeDraft, isOfficial, draftApproved, approved, showReview, showPreferenceCard } =
    selectClientFloorPlanLayout(officialDraft, preferenceDrafts);

  return (
    <div className="space-y-5">
      {officialPlan ? <OfficialFloorPlanCard draft={officialPlan} officialLayout={officialLayout} onOpenEditor={openFloorplanEditor} /> : null}
      {selectedEvent && officialPlan && showReview ? (
        <ClientFloorplanReviewPanel eventId={selectedEvent.id} draftId={officialPlan.id} onDecided={refresh} />
      ) : null}
      <FloorPlanRevisionCommentCard draft={officialPlan ?? activeDraft} event={selectedEvent} />
      {showPreferenceCard ? (
        <Card className="gap-0 py-0">
          <FloorPlanCardHeader approved={draftApproved} isOfficial={isOfficial} activeDraft={activeDraft} />
          <div className="p-6">
            <FloorPlanDraftPanel
              approved={draftApproved}
              isOfficial={isOfficial}
              activeDraft={activeDraft}
              officialLayout={officialLayout}
              onOpenEditor={openFloorplanEditor}
            />
          </div>
        </Card>
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
