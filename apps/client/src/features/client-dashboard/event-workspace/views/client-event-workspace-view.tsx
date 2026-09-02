"use client";

import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientEventRouteBody } from "./client-event-route-body";

export function ClientEventWorkspaceView() {
  const { selectedEvent, eventHeader } = useClientWorkspace();

  if (!selectedEvent) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="No active event portal"
        description="The client portal opens after your inquiry is accepted and the signed conforme is uploaded."
        className="mt-8"
      />
    );
  }

  return (
    <div className="space-y-5">
      {eventHeader}
      <ClientEventRouteBody />
    </div>
  );
}
