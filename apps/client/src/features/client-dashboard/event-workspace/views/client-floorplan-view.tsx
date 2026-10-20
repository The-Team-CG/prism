"use client";

import { useClientWorkspace } from "../../workspace/shared";
import {
  FloorPlanCardHeader,
  FloorPlanDraftPanel,
  FloorPlanRevisionCommentCard,
  FloorPlanTemplates,
  GuidedLayoutNotes,
} from "./sections/client-floorplan-sections";
import { ClientFloorplanReviewPanel } from "../../floorplan-review/views/client-floorplan-review-panel";

export function ClientFloorPlanView() {
  const {
    selectedEvent,
    officialDraft,
    preferenceDrafts,
    officialProject,
    floorPlanTemplates,
    revisionComment,
    setRevisionComment,
    form,
    setForm,
    openFloorplanEditor,
    createEditorDraft,
    submitPreference,
    submitRevisionComment,
    busy,
  } = useClientWorkspace();

  const activeDraft = officialDraft ?? preferenceDrafts[0];
  const approved = officialDraft?.status === "approved";
  const isOfficial = Boolean(officialDraft);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <FloorPlanCardHeader approved={approved} isOfficial={isOfficial} activeDraft={activeDraft} />
        <div className="p-6">
          <FloorPlanDraftPanel
            approved={approved}
            isOfficial={isOfficial}
            activeDraft={activeDraft}
            officialProject={officialProject}
            onOpenEditor={openFloorplanEditor}
          />
          <FloorPlanTemplates
            approved={approved || isOfficial}
            templates={floorPlanTemplates}
            busy={busy}
            onCreate={createEditorDraft}
          />
        </div>
      </div>
      <FloorPlanRevisionCommentCard
        draft={activeDraft}
        event={selectedEvent}
        value={revisionComment}
        setValue={setRevisionComment}
        busy={busy === "floorplan-revision"}
        onSubmit={submitRevisionComment}
      />
      {selectedEvent && officialDraft && (officialDraft.status === "in_review" || officialDraft.status === "approved") ? (
        <ClientFloorplanReviewPanel eventId={selectedEvent.id} draftId={officialDraft.id} />
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
