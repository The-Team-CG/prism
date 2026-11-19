"use client";

import { useClientWorkspace } from "../../workspace/shared";
import { GuidedLayoutNotes, LayoutIdeasSection, OfficialLayoutSection } from "./sections/client-floorplan-sections";
import { ClientFloorplanReviewPanel } from "../../floorplan-review/views/client-floorplan-review-panel";
import { selectClientFloorPlanLayout } from "../../workspace/model/client-floorplan-review-rules";

/** The official layout first, then the client's own ideas and, until the layout is approved, a way to send more. */
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

  const { officialPlan, approved, showReview } = selectClientFloorPlanLayout(officialDraft, preferenceDrafts);

  return (
    <div className="space-y-6">
      <OfficialLayoutSection draft={officialPlan} layout={officialLayout} reviewing={showReview} onOpenEditor={openFloorplanEditor} />
      {selectedEvent && officialPlan && showReview ? (
        <ClientFloorplanReviewPanel eventId={selectedEvent.id} draftId={officialPlan.id} onDecided={refresh} />
      ) : null}
      <LayoutIdeasSection drafts={preferenceDrafts} approved={approved} onOpenEditor={openFloorplanEditor} />
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
