import { ClientSharedFloorplanSnapshotView } from "@/features/client-shared-floorplans/views/client-shared-floorplan-snapshot-view";

type Props = {
  params: Promise<{ eventId: string; draftId: string; snapshotType: string }>;
};

export default async function SharedFloorplanSnapshotPage({ params }: Props) {
  const { eventId, draftId, snapshotType } = await params;
  return (
    <ClientSharedFloorplanSnapshotView
      eventId={eventId}
      draftId={draftId}
      snapshotType={snapshotType}
    />
  );
}
