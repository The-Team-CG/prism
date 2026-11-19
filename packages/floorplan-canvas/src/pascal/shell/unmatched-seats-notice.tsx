"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { usePrismFloorplan } from "../editor-context";

/** Said once when a converted plan had seats whose guests are not on the event's guest list. */
export function UnmatchedSeatsNotice() {
  const { unmatchedSeats } = usePrismFloorplan();
  const [dismissed, setDismissed] = useState(false);
  if (unmatchedSeats === 0 || dismissed) return null;
  return (
    <div role="status" className="pointer-events-auto absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md bg-foreground px-3 py-2 text-sm text-background shadow-lg">
      {unmatchedSeats} {unmatchedSeats === 1 ? "seat" : "seats"} could not be matched to the guest list
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-background/20">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
