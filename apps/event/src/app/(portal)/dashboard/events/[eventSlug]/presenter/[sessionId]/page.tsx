"use client";

import { use } from "react";
import { PresenterScreen } from "@/features/event-games/presenter/presenter-screen";
import { usePresenterViewModel } from "@/features/event-games/presenter/use-presenter-view-model";

/** Big-screen presenter view for one host session. The `eventSlug` segment carries the event ID. */
export default function EventGamePresenterPage({ params }: { params: Promise<{ eventSlug: string; sessionId: string }> }) {
  const { eventSlug: eventId, sessionId } = use(params);
  const viewModel = usePresenterViewModel(eventId, sessionId);

  if (!viewModel.state) {
    return (
      <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--prism-ink)] p-8 text-center text-white">
        <p role={viewModel.error ? "alert" : "status"} className="max-w-3xl text-3xl font-semibold">
          {viewModel.error ?? "Loading the game…"}
        </p>
      </main>
    );
  }

  return (
    <PresenterScreen
      state={viewModel.state}
      receivedAt={viewModel.receivedAt}
      error={viewModel.error}
      joinUrl={viewModel.joinUrl}
      joinError={viewModel.joinError}
      pin={viewModel.pin}
      issuingPin={viewModel.issuingPin}
      pinError={viewModel.pinError}
      onIssuePin={() => { void viewModel.issuePin(); }}
      pictureUrl={viewModel.pictureUrl}
    />
  );
}
