"use client";

import { CalendarClock, Lock } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import { cn } from "@/app/components/ui/utils";
import { clientChangeDeadline } from "./client-change-deadline";

/** One line on when the client can still request changes; amber in the last two weeks and once changes are closed. */
export function ClientChangeDeadlineNotice({ event, todayKey }: { event: PrismEvent; todayKey: string }) {
  const deadline = clientChangeDeadline(event, todayKey);
  if (!deadline) return null;
  const warn = deadline.kind === "closed" || deadline.soon;
  const Icon = deadline.kind === "closed" ? Lock : CalendarClock;
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        warn ? "border-attention/30 bg-attention-soft text-foreground" : "border-border bg-card text-muted-foreground",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", warn ? "text-attention" : "text-muted-foreground")} />
      {deadline.kind === "closed" ? (
        <span>Changes are closed for this event. Any further change needs PMCM to approve an exception.</span>
      ) : (
        <span>
          Change requests close <span className="font-semibold text-foreground">{formatPortalDate(deadline.deadlineAt)}</span>
          {" · "}{deadline.daysLeft === 0 ? "today" : deadline.daysLeft === 1 ? "1 day left" : `${deadline.daysLeft} days left`}.
          {" "}After that, a change needs PMCM to approve an exception.
        </span>
      )}
    </p>
  );
}
